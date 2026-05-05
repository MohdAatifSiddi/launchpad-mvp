import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import DodoPayments from "https://esm.sh/dodopayments@2.4.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DODO_API_KEY = Deno.env.get("DODO_PAYMENTS_API_KEY")!;
const DODO_ENV = (Deno.env.get("DODO_PAYMENTS_ENV") ?? "test_mode") as "test_mode" | "live_mode";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: sub } = await admin.from("subscriptions").select("id, dodo_subscription_id").eq("user_id", user.id).maybeSingle();
    if (!sub?.dodo_subscription_id) return json({ error: "No active subscription found" }, 404);

    const dodo = new DodoPayments({ bearerToken: DODO_API_KEY, environment: DODO_ENV });
    await dodo.subscriptions.update(sub.dodo_subscription_id, { status: "cancelled" } as any);

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
