import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Check, IndianRupee, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const startTrial = async (plan: "solo" | "firm") => {
    if (!user) { navigate("/auth?mode=signup"); return; }
    setLoading(plan);
    try {
      await loadRazorpay();
      const { data, error } = await supabase.functions.invoke("create-razorpay-subscription", { body: { plan } });
      if (error) throw error;
      if (!window.Razorpay) throw new Error("Razorpay checkout did not load");

      const checkout = new window.Razorpay({
        key: data.key_id,
        name: data.name,
        description: data.description,
        subscription_id: data.subscription_id,
        currency: data.currency,
        amount: data.amount,
        prefill: data.prefill,
        handler: async (response: any) => {
          const verified = await supabase.functions.invoke("verify-razorpay-payment", { body: response });
          if (verified.error) throw verified.error;
          toast.success("Payment verified", { description: "Your Weybre AI workspace is active." });
          navigate("/app");
        },
        modal: { ondismiss: () => setLoading(null) },
      });
      checkout.open();
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to start Razorpay checkout");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-hero">
      <header className="container flex h-16 items-center"><Logo /></header>
      <main className="container max-w-5xl py-10">
        <p className="text-center font-mono text-xs uppercase tracking-wider text-accent">Step 2 of 2 · Choose plan</p>
        <h1 className="mt-2 text-center font-serif text-3xl font-semibold text-primary md:text-4xl">
          Start your 7-day paid trial
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Secure subscription checkout via Razorpay. Cancel anytime in Settings.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Plan
            name="Solo"
            price="999"
            period="/lawyer / month"
            features={["Unlimited research queries", "20 contract drafts / month", "Save to matters & export PDF/DOCX", "GST-compliant invoices", "Email support"]}
            cta="Start Solo trial"
            loading={loading === "solo"}
            onClick={() => startTrial("solo")}
          />
          <Plan
            name="Firm"
            highlight
            price="2,499"
            period="/month · up to 3 seats"
            features={["Everything in Solo", "3 lawyer seats (v2)", "Unlimited drafts", "Priority support", "Roadmap: shared matters"]}
            cta="Start Firm trial"
            loading={loading === "firm"}
            onClick={() => startTrial("firm")}
          />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Prices in INR · GST extra · By paying you agree to our Terms, Privacy Policy, Refund Policy, and AI Disclaimer.
        </p>
      </main>
    </div>
  );
};

const loadRazorpay = () => new Promise<void>((resolve, reject) => {
  if (window.Razorpay) { resolve(); return; }
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error("Could not load Razorpay checkout"));
  document.body.appendChild(script);
});

const Plan = ({ name, price, period, features, cta, highlight, loading, onClick }: any) => (
  <div className={`relative rounded-xl border p-7 ${highlight ? "border-accent/50 shadow-glow bg-card" : "border-border bg-card"}`}>
    {highlight && <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider text-accent-foreground">Most popular</span>}
    <h3 className="font-serif text-xl font-semibold text-primary">{name}</h3>
    <div className="mt-3 flex items-baseline gap-1">
      <span className="font-serif text-4xl font-semibold text-primary">₹{price}</span>
      <span className="text-sm text-muted-foreground">{period}</span>
    </div>
    <Button onClick={onClick} disabled={loading} className="mt-5 w-full" variant={highlight ? "default" : "outline"}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : highlight ? <ShieldCheck className="h-4 w-4" /> : <IndianRupee className="h-4 w-4" />}
      {cta}
    </Button>
    <ul className="mt-6 space-y-2.5 text-sm">
      {features.map((f: string) => (
        <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" /><span>{f}</span></li>
      ))}
    </ul>
  </div>
);

export default Pricing;
