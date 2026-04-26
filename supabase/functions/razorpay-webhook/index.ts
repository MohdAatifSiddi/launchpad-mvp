import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    if (!WEBHOOK_SECRET) return json({ error: "Webhook secret is not configured" }, 500);
    if ((await hmac(raw, WEBHOOK_SECRET)) !== signature) return json({ error: "Invalid webhook signature" }, 400);

    const event = JSON.parse(raw);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const subscriptionEntity = event?.payload?.subscription?.entity;
    const paymentEntity = event?.payload?.payment?.entity;
    const razorpaySubscriptionId = subscriptionEntity?.id ?? paymentEntity?.subscription_id;
    if (!razorpaySubscriptionId) return json({ ok: true, ignored: true });

    const { data: sub } = await admin.from("subscriptions").select("id, user_id").eq("razorpay_subscription_id", razorpaySubscriptionId).maybeSingle();
    if (!sub) return json({ ok: true, unmatched: true });

    const updates: Record<string, string | null> = {};
    if (["subscription.activated", "invoice.paid", "payment.authorized", "payment.captured"].includes(event.event)) {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      updates.status = "active";
      updates.checkout_status = "paid";
      updates.last_payment_at = new Date().toISOString();
      updates.current_period_end = periodEnd.toISOString();
      if (paymentEntity?.id) updates.razorpay_payment_id = paymentEntity.id;
    }
    if (["subscription.cancelled", "subscription.completed"].includes(event.event)) {
      updates.status = "cancelled";
      updates.cancelled_at = new Date().toISOString();
    }
    if (["payment.failed", "subscription.pending"].includes(event.event)) {
      updates.status = "past_due";
      updates.checkout_status = "payment_failed";
    }
    if (Object.keys(updates).length) await admin.from("subscriptions").update(updates).eq("id", sub.id);

    await admin.from("billing_events").insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      event_type: event.event ?? "webhook",
      provider_event_id: paymentEntity?.id ?? subscriptionEntity?.id ?? event?.id,
      amount: paymentEntity?.amount,
      currency: paymentEntity?.currency ?? "INR",
      status: paymentEntity?.status ?? subscriptionEntity?.status ?? "received",
      payload: event,
    });

    return json({ ok: true });
  } catch (e) {
    console.error("razorpay-webhook error", e);
    return json({ error: e instanceof Error ? e.message : "Webhook failed" }, 500);
  }
});

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
