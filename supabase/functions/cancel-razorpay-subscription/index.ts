import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
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

    const { data: sub, error } = await admin.from("subscriptions").select("id, razorpay_subscription_id").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!sub?.razorpay_subscription_id) return json({ error: "No active Razorpay subscription found" }, 404);

    const cancelled = await razorpay(`/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`, "POST", { cancel_at_cycle_end: 1 });
    await admin.from("subscriptions").update({ status: "cancelled", checkout_status: "cancel_requested", cancelled_at: new Date().toISOString() }).eq("id", sub.id);
    await admin.from("billing_events").insert({ user_id: user.id, subscription_id: sub.id, event_type: "cancel_requested", provider_event_id: sub.razorpay_subscription_id, status: cancelled.status ?? "cancelled", payload: cancelled });
    return json({ ok: true });
  } catch (e) {
    console.error("cancel-razorpay-subscription error", e);
    return json({ error: e instanceof Error ? e.message : "Unable to cancel subscription" }, 500);
  }
});

async function razorpay(path: string, method: string, body?: unknown) {
  const res = await fetch(`https://api.razorpay.com${path}`, {
    method,
    headers: { Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay API failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
