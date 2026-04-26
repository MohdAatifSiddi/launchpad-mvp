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

const PLANS = {
  solo: { name: "Weybre AI Solo", amount: 99900, description: "Monthly access for one lawyer" },
  firm: { name: "Weybre AI Firm", amount: 249900, description: "Monthly access for up to 3 seats" },
} as const;

type PlanTier = keyof typeof PLANS;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return json({ error: "Razorpay is not configured" }, 500);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.email) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as PlanTier;
    if (!plan || !(plan in PLANS)) return json({ error: "Invalid plan" }, 400);

    const planId = await ensureRazorpayPlan(admin, plan);
    const subscription = await razorpay("/v1/subscriptions", "POST", {
      plan_id: planId,
      total_count: 120,
      quantity: 1,
      customer_notify: 0,
      notes: { user_id: user.id, plan, product: "Weybre AI" },
    });

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    const { data: saved, error } = await admin
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        plan,
        status: "incomplete",
        checkout_status: "created",
        trial_end: trialEnd.toISOString(),
        razorpay_subscription_id: subscription.id,
        razorpay_order_id: null,
        cancelled_at: null,
      }, { onConflict: "user_id" })
      .select("id")
      .single();
    if (error) throw error;

    await admin.from("billing_events").insert({
      user_id: user.id,
      subscription_id: saved.id,
      event_type: "checkout_created",
      provider_event_id: subscription.id,
      amount: PLANS[plan].amount,
      status: subscription.status ?? "created",
      payload: subscription,
    });

    return json({
      key_id: RAZORPAY_KEY_ID,
      subscription_id: subscription.id,
      plan,
      amount: PLANS[plan].amount,
      currency: "INR",
      name: "Weybre AI",
      description: PLANS[plan].description,
      prefill: { email: user.email, name: user.user_metadata?.full_name ?? "" },
    });
  } catch (e) {
    console.error("create-razorpay-subscription error", e);
    return json({ error: e instanceof Error ? e.message : "Unable to start checkout" }, 500);
  }
});

async function ensureRazorpayPlan(admin: ReturnType<typeof createClient>, plan: PlanTier): Promise<string> {
  const existing = await admin.from("billing_plans").select("provider_plan_id").eq("plan", plan).eq("active", true).maybeSingle();
  if (existing.data?.provider_plan_id) return existing.data.provider_plan_id;

  const spec = PLANS[plan];
  const created = await razorpay("/v1/plans", "POST", {
    period: "monthly",
    interval: 1,
    item: { name: spec.name, amount: spec.amount, currency: "INR", description: spec.description },
    notes: { plan, product: "Weybre AI" },
  });
  await admin.from("billing_plans").upsert({ plan, provider_plan_id: created.id, amount: spec.amount, currency: "INR", interval: "monthly", active: true }, { onConflict: "plan" });
  return created.id;
}

async function razorpay(path: string, method: string, body?: unknown) {
  const res = await fetch(`https://api.razorpay.com${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay API failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
