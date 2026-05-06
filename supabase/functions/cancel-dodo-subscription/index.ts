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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Allow admin-initiated cancellation via body.user_id
    const isAdmin = (await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()).data;
    const body = await req.json().catch(() => ({}));
    const targetUserId: string = (isAdmin && body.user_id) || user.id;

    const { data: sub } = await admin.from("subscriptions").select("id, dodo_subscription_id").eq("user_id", targetUserId).maybeSingle();
    if (!sub?.dodo_subscription_id) return json({ error: "No active subscription found" }, 404);

    const res = await fetch(`${DODO_BASE}/subscriptions/${sub.dodo_subscription_id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${DODO_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("dodo cancel error", res.status, text);
      return json({ error: `Dodo Payments error: ${text}` }, 500);
    }

    await admin.from("subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", sub.id);
    return json({ ok: true });
  } catch (e) {
    console.error("cancel-dodo-subscription error", e);
    return json({ error: e instanceof Error ? e.message : "Unable to cancel" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
