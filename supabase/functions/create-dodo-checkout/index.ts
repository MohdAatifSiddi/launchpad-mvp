import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DODO_API_KEY = Deno.env.get("DODO_PAYMENTS_API_KEY")!;
const DODO_ENV = (Deno.env.get("DODO_PAYMENTS_ENV") ?? "test_mode") as "test_mode" | "live_mode";
const DODO_BASE = DODO_ENV === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

const PRODUCT_IDS: Record<string, string | undefined> = {
  solo: Deno.env.get("DODO_PRODUCT_ID_SOLO"),
  firm: Deno.env.get("DODO_PRODUCT_ID_FIRM"),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!DODO_API_KEY) return json({ error: "Dodo Payments is not configured" }, 500);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.email) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as "solo" | "firm";
    const productId = PRODUCT_IDS[plan];
    if (!plan || !productId) return json({ error: `Invalid plan or missing DODO_PRODUCT_ID_${(plan ?? "").toUpperCase()}` }, 400);

    const origin = req.headers.get("origin") ?? body.origin ?? "https://weybre.ai";
    const returnUrl = `${origin}/app?checkout=success`;

    const profile = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const fullName = profile.data?.full_name ?? user.user_metadata?.full_name ?? user.email.split("@")[0];

    // Direct REST call to Dodo Payments — create subscription with hosted payment link
    const payload = {
      product_id: productId,
      quantity: 1,
      payment_link: true,
      return_url: returnUrl,
      billing: {
        country: "IN",
        state: "Karnataka",
        city: "Bengaluru",
        street: "—",
        zipcode: "560001",
      },
      customer: { email: user.email, name: fullName },
      metadata: { user_id: user.id, plan, product: "Weybre AI" },
    };

    const dodoRes = await fetch(`${DODO_BASE}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const dodoText = await dodoRes.text();
    if (!dodoRes.ok) {
      console.error("dodo error", dodoRes.status, dodoText);
      return json({ error: `Dodo Payments error: ${dodoText}` }, 500);
    }
    const session = JSON.parse(dodoText);
    const checkoutUrl: string | undefined = session.payment_link ?? session.checkout_url ?? session.url;
    if (!checkoutUrl) {
      console.error("dodo response missing payment_link", session);
      return json({ error: "Dodo Payments did not return a checkout URL" }, 500);
    }

    const { data: saved, error } = await admin
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        plan,
        status: "incomplete",
        checkout_status: "created",
        trial_end: null,
        dodo_subscription_id: session.subscription_id ?? null,
        dodo_customer_id: session.customer?.customer_id ?? null,
        cancelled_at: null,
      }, { onConflict: "user_id" })
      .select("id")
      .single();
    if (error) throw error;

    await admin.from("billing_events").insert({
      user_id: user.id,
      subscription_id: saved.id,
      provider: "dodo",
      event_type: "subscription.created",
      provider_event_id: session.subscription_id ?? null,
      currency: "INR",
      status: "created",
      payload: session,
    });

    return json({ checkout_url: checkoutUrl });
  } catch (e) {
    console.error("create-dodo-checkout error", e);
    return json({ error: e instanceof Error ? e.message : "Unable to start checkout" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
