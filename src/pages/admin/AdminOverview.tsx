import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, CreditCard, IndianRupee, TrendingUp } from "lucide-react";

const AdminOverview = () => {
  const [stats, setStats] = useState({ users: 0, active: 0, trialing: 0, mrr: 0, queries: 0, drafts: 0 });

  useEffect(() => {
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [{ count: users }, { data: subs }, { count: queries }, { count: drafts }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("subscriptions").select("plan,status"),
        supabase.from("usage_events").select("*", { count: "exact", head: true }).eq("event_type", "research_query").gte("created_at", monthStart.toISOString()),
        supabase.from("drafts").select("*", { count: "exact", head: true }),
      ]);
      const active = subs?.filter((s) => s.status === "active").length ?? 0;
      const trialing = subs?.filter((s) => s.status === "trialing").length ?? 0;
      const mrr = (subs ?? []).reduce((acc, s) => {
        if (s.status !== "active") return acc;
        return acc + (s.plan === "firm" ? 2499 : 999);
      }, 0);
      setStats({ users: users ?? 0, active, trialing, mrr, queries: queries ?? 0, drafts: drafts ?? 0 });
    })();
  }, []);

  return (
    <AdminShell title="Overview">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Total customers" value={stats.users} />
        <Stat icon={<CreditCard className="h-4 w-4" />} label="Active subs" value={stats.active} sub={`${stats.trialing} on trial`} />
        <Stat icon={<IndianRupee className="h-4 w-4" />} label="MRR (active)" value={`₹${stats.mrr.toLocaleString("en-IN")}`} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Queries this month" value={stats.queries} sub={`${stats.drafts} total drafts`} />
      </div>
    </AdminShell>
  );
};

const Stat = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number | string; sub?: string }) => (
  <Card className="p-5">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">{icon}</span>
      {label}
    </div>
    <div className="mt-3 font-serif text-3xl font-semibold tracking-tight text-foreground">{value}</div>
    {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
  </Card>
);

export default AdminOverview;
