import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export type SubStatus = "trialing" | "active" | "past_due" | "cancelled" | "incomplete";
export type PlanTier = "solo" | "firm";

export interface Subscription {
  plan: PlanTier;
  status: SubStatus;
  current_period_end: string | null;
  trial_end: string | null;
  checkout_status?: string | null;
  dodo_subscription_id?: string | null;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setSub(null); setLoading(false); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan,status,current_period_end,trial_end,checkout_status,dodo_subscription_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (active) { setSub(data as Subscription | null); setLoading(false); }
    })();
    return () => { active = false; };
  }, [user]);

  const inTrial = !!sub?.trial_end && new Date(sub.trial_end).getTime() > Date.now();
  const isActive =
    sub?.status === "active" ||
    sub?.status === "trialing" ||
    (sub?.status === "incomplete" && inTrial);
  return { sub, loading, isActive };
};
