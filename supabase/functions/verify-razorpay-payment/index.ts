import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await req.json();
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) return json({ error: "Missing payment verification fields" }, 400);

    const expected = await hmac(`${razorpay_payment_id}|${razorpay_subscription_id}`, RAZORPAY_KEY_SECRET);
    if (expected !== razorpay_signature) return json({ error: "Payment verification failed" }, 400);

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const { data: sub, error } = await admin
      .from("subscriptions")
      .update({
        status: "active",
        checkout_status: "paid",
        razorpay_payment_id,
        last_payment_at: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("user_id", user.id)
      .eq("razorpay_subscription_id", razorpay_subscription_id)
      .select("id, plan")
      .single();
    if (error) throw error;

    await admin.from("billing_events").insert({
      user_id: user.id,
      subscription_id: sub.id,
      event_type: "payment_verified",
      provider_event_id: razorpay_payment_id,
      status: "paid",
      payload: { razorpay_payment_id, razorpay_subscription_id },
    });

    return json({ ok: true, status: "active", plan: sub.plan });
  } catch (e) {
    console.error("verify-razorpay-payment error", e);
    return json({ error: e instanceof Error ? e.message : "Unable to verify payment" }, 500);
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
