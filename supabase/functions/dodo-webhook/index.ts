import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import DodoPayments from "https://esm.sh/dodopayments@2.4.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DODO_API_KEY = Deno.env.get("DODO_PAYMENTS_API_KEY")!;
const DODO_WEBHOOK_KEY = Deno.env.get("DODO_PAYMENTS_WEBHOOK_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!DODO_WEBHOOK_KEY) return json({ error: "Webhook key not configured" }, 500);

    const raw = await req.text();
    const headers = {
      "webhook-id": req.headers.get("webhook-id") ?? "",
      "webhook-signature": req.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
    };

    const dodo = new DodoPayments({ bearerToken: DODO_API_KEY, webhookKey: DODO_WEBHOOK_KEY });
    try {
      await dodo.webhooks.unwrap(raw, { headers });
    } catch (e) {
      console.error("dodo signature failed", e);
      return json({ error: "Invalid webhook signature" }, 401);
    }

    const event = JSON.parse(raw);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const eventType: string = event.type ?? "";
    const data = event.data ?? {};
    const metadata = data.metadata ?? {};
    const subId: string | undefined = data.subscription_id ?? data.id;
    const customerId: string | undefined = data.customer?.customer_id;
    const userIdFromMeta: string | undefined = metadata.user_id;
    const planFromMeta: "solo" | "firm" | undefined = metadata.plan;

    // Find subscription row: by dodo_subscription_id, then by checkout session, then by user_id from metadata
    let subRow: { id: string; user_id: string } | null = null;
    if (subId) {
      const r = await admin.from("subscriptions").select("id, user_id").eq("dodo_subscription_id", subId).maybeSingle();
      if (r.data) subRow = r.data;
    }
    if (!subRow && userIdFromMeta) {
      const r = await admin.from("subscriptions").select("id, user_id").eq("user_id", userIdFromMeta).maybeSingle();
      if (r.data) subRow = r.data;
    }

    const updates: Record<string, unknown> = { dodo_subscription_id: subId, dodo_customer_id: customerId };
    if (planFromMeta) updates.plan = planFromMeta;

    switch (eventType) {
      case "subscription.active":
      case "subscription.renewed":
        updates.status = "active";
        updates.checkout_status = "paid";
        updates.last_payment_at = new Date().toISOString();
        if (data.next_billing_date) updates.current_period_end = new Date(data.next_billing_date).toISOString();
        break;
      case "subscription.cancelled":
      case "subscription.expired":
        updates.status = "cancelled";
        updates.cancelled_at = new Date().toISOString();
        break;
      case "subscription.on_hold":
      case "subscription.failed":
        updates.status = "past_due";
        updates.checkout_status = "payment_failed";
        break;
      case "payment.succeeded":
        updates.last_payment_at = new Date().toISOString();
        if (data.payment_id) updates.dodo_payment_id = data.payment_id;
        break;
    }

    if (subRow && Object.keys(updates).length) {
      await admin.from("subscriptions").update(updates).eq("id", subRow.id);
    } else if (!subRow && userIdFromMeta && eventType.startsWith("subscription.")) {
      await admin.from("subscriptions").upsert({
        user_id: userIdFromMeta,
        plan: planFromMeta ?? "solo",
        status: updates.status ?? "incomplete",
        ...updates,
      }, { onConflict: "user_id" });
    }

    await admin.from("billing_events").insert({
      user_id: subRow?.user_id ?? userIdFromMeta ?? "00000000-0000-0000-0000-000000000000",
      subscription_id: subRow?.id ?? null,
      provider: "dodo",
      event_type: eventType || "webhook",
      provider_event_id: req.headers.get("webhook-id") ?? subId ?? null,
      amount: data.recurring_pre_tax_amount ?? data.total_amount ?? null,
      currency: data.currency ?? "INR",
      status: data.status ?? "received",
      payload: event,
    });

    return json({ ok: true });
  } catch (e) {
    console.error("dodo-webhook error", e);
    return json({ error: e instanceof Error ? e.message : "Webhook failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
