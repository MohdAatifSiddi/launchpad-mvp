import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, FileText, ShieldCheck, Sparkles, Quote, Check, ScrollText, Gavel, Lock, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import heroImg from "@/assets/hero.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-hero">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground transition-colors">Product</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign in</Link>
          </nav>
          <Button asChild size="sm" className="bg-primary hover:bg-primary-glow">
            <Link to="/auth?mode=signup">Start paid trial</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container grid gap-12 py-16 lg:grid-cols-2 lg:gap-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3 text-accent" />
              Built for Indian law · Supreme Court corpus, day one
            </div>
            <h1 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-primary md:text-6xl">
              Turn 8 hours of legal research into <span className="text-accent">8 minutes.</span>
            </h1>
            <p className="mt-5 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
              Weybre AI is the AI co-counsel for Indian advocates. Search Supreme Court judgments and the open web in plain English, get cited answers in seconds, and draft contracts grounded in real precedent.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bg-primary text-base hover:bg-primary-glow">
                <Link to="/auth?mode=signup">
                  Start 7-day paid trial — ₹999/mo <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base">
                <a href="#features">See how it works</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Card required · Cancel anytime · GST invoice included
            </p>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border/60 pt-6 text-sm">
              <Stat label="SC judgments indexed" value="18,000+" />
              <Stat label="Avg. answer time" value="< 10s" />
              <Stat label="Hosted in" value="🇮🇳 India" />
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-accent/20 via-transparent to-primary/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-border/80 shadow-elegant">
              <img src={heroImg} alt="A lawyer's desk with Supreme Court of India volumes and brass scales of justice" width={1600} height={1200} className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-4 hidden max-w-xs rounded-xl border border-border bg-card p-4 shadow-elegant md:block">
              <div className="mb-2 flex items-center gap-2">
                <Quote className="h-4 w-4 text-accent" />
                <span className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">Cited answer</span>
              </div>
              <p className="font-serif text-sm leading-snug text-foreground">
                "Specific performance was denied due to inordinate delay in seeking relief…"
              </p>
              <p className="mt-2 font-mono text-[0.7rem] text-muted-foreground">2023 INSC 1043 · Para 27</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border/60 bg-card/50 py-6">
        <div className="container flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>🇮🇳 DPDP-aligned data residency</span>
          <span>•</span>
          <span>Supreme Court of India</span>
          <span>•</span>
          <span>25 High Courts (roadmap)</span>
          <span>•</span>
          <span>BCI-aware disclosures</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-accent">The Product</p>
          <h2 className="font-serif text-3xl font-semibold leading-tight text-primary md:text-4xl">
            Two modules. One unified workspace.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every answer is grounded in cited judgments. Every clause is backed by precedent. No black boxes.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <FeatureCard
            icon={<BookOpenCheck className="h-5 w-5" />}
            tag="Research"
            title="Ask in plain English. Get cited Indian case law."
            bullets={[
              "Hybrid semantic + keyword search over SC judgments",
              "Streaming AI answers with inline citation chips",
              "Save research notes to matters, export to PDF/DOCX",
            ]}
          />
          <FeatureCard
            icon={<FileText className="h-5 w-5" />}
            tag="Draft"
            title="Generate Indian contracts grounded in precedent."
            bullets={[
              "NDA, Employment, Service, Notice, Reply, Vakalatnama",
              "Clause-by-clause risk flags & confidence chips",
              "'Cite a precedent' — backed by real SC judgments",
            ]}
          />
        </div>

        {/* Trust pillars */}
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Pillar icon={<ShieldCheck className="h-5 w-5" />} title="Honest by default" body="Every AI output shows 'Verify before filing'. Every citation is clickable to its source." />
          <Pillar icon={<ScrollText className="h-5 w-5" />} title="Indian citation format" body="Outputs use the neutral citation system (e.g. 2023 INSC 1043) used in Indian courts." />
          <Pillar icon={<Lock className="h-5 w-5" />} title="DPDP-compliant" body="Your matters and queries stay private. One-click delete-my-data in settings." />
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/60 bg-secondary/30 py-20">
        <div className="container">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-accent">How it works</p>
            <h2 className="font-serif text-3xl font-semibold text-primary md:text-4xl">From query to citation in three steps.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Step n={1} title="Ask" body="Type a legal question — in English or Hindi — the way you'd ask a junior associate." />
            <Step n={2} title="Retrieve" body="Hybrid search pulls the most relevant SC judgments from our embedded corpus." />
            <Step n={3} title="Answer" body="A grounded answer with inline citations, direct quotes, and a clear reasoning trail." />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-accent">Pricing</p>
          <h2 className="font-serif text-3xl font-semibold text-primary md:text-4xl">Honest, paid-only pricing.</h2>
          <p className="mt-3 text-muted-foreground">No freemium games. Card required. Cancel anytime.</p>
        </div>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <PriceCard
            name="Solo"
            price="999"
            period="/lawyer / month"
            highlight={false}
            features={[
              "Unlimited research queries",
              "20 contract drafts / month",
              "Save to matters & export",
              "GST-compliant invoices",
              "Email support",
            ]}
          />
          <PriceCard
            name="Firm"
            price="2,499"
            period="/month · up to 3 seats"
            highlight={true}
            features={[
              "Everything in Solo",
              "3 lawyer seats",
              "Unlimited drafts",
              "Priority support",
              "Roadmap: shared matters",
            ]}
          />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prices in INR, exclusive of GST. 7-day paid trial on all plans.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/60 bg-card/30 py-20">
        <div className="container max-w-3xl">
          <h2 className="mb-10 text-center font-serif text-3xl font-semibold text-primary md:text-4xl">
            Honest answers to honest questions.
          </h2>
          <div className="space-y-6">
            <Faq q="Will Weybre AI hallucinate citations?" a="Our hybrid retrieval grounds every answer in real SC judgments and live web sources before the LLM responds. Every citation is clickable to its source. We deliberately surface 'Verify before filing' on every output — AI is a co-counsel, not a substitute." />
            <Faq q="Is my client data safe?" a="Yes. Your matters, drafts, and queries are isolated per-account with row-level security. Data is hosted in India in alignment with the DPDP Act. You can delete all your data with one click in Settings." />
            <Faq q="Which sources are covered?" a="Case law: full Supreme Court of India corpus (2000–present), with High Courts rolling out month-by-month. Web: live, cited search across legal news, government portals, journals and bare acts." />
            <Faq q="What about the Bar Council and UPL rules?" a="Weybre AI is a productivity tool for licensed advocates. We collect your Bar Council number at signup, and every output carries a clear AI-generated disclosure. Weybre AI does not provide legal advice or solicit work from the public." />
            <Faq q="Can I cancel anytime?" a="Yes. Self-serve cancellation in Settings. You keep access through the end of the billing period and can export your matters before leaving." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-primary p-10 text-center md:p-16">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--accent)) 0, transparent 40%)" }} />
          <div className="relative">
            <Gavel className="mx-auto mb-4 h-8 w-8 text-accent" />
            <h2 className="font-serif text-3xl font-semibold text-primary-foreground md:text-4xl">
              Be among the first 100 lawyers to win back their evenings.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
              Start your 7-day paid trial. No call. No demo. Just open the app and start researching.
            </p>
            <Button asChild size="lg" className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth?mode=signup">
                <IndianRupee className="h-4 w-4" /> Start trial — ₹999/month
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card/40 py-10">
        <div className="container flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Logo />
            <p className="mt-3 max-w-md text-xs text-muted-foreground">
              Weybre AI is a legal research and drafting productivity tool for Indian advocates. Outputs are AI-generated and must be independently verified by a licensed advocate before any filing or advice. Weybre AI does not constitute legal advice and does not solicit work in violation of the Bar Council of India Rules.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Weybre AI · Made in India
          </div>
        </div>
      </footer>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="font-serif text-2xl font-semibold text-primary">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

const FeatureCard = ({ icon, tag, title, bullets }: { icon: React.ReactNode; tag: string; title: string; bullets: string[] }) => (
  <div className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-7 transition-all hover:border-accent/40 hover:shadow-md">
    <div className="mb-5 flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">{icon}</span>
      <span className="font-mono text-[0.7rem] uppercase tracking-wider text-accent">{tag}</span>
    </div>
    <h3 className="font-serif text-2xl font-semibold leading-snug text-primary">{title}</h3>
    <ul className="mt-5 space-y-2.5 text-sm">
      {bullets.map(b => (
        <li key={b} className="flex items-start gap-2 text-muted-foreground">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Pillar = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="rounded-lg border border-border/60 bg-card/60 p-5">
    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">{icon}</div>
    <h4 className="font-serif text-base font-semibold text-primary">{title}</h4>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
  </div>
);

const Step = ({ n, title, body }: { n: number; title: string; body: string }) => (
  <div className="rounded-xl border border-border/60 bg-card p-6">
    <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono text-sm text-primary-foreground">{n}</div>
    <h4 className="font-serif text-lg font-semibold text-primary">{title}</h4>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
  </div>
);

const PriceCard = ({ name, price, period, features, highlight }: { name: string; price: string; period: string; features: string[]; highlight: boolean }) => (
  <div className={`relative rounded-xl border p-7 ${highlight ? "border-accent/50 bg-card shadow-glow" : "border-border bg-card"}`}>
    {highlight && <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider text-accent-foreground">Most popular</span>}
    <h3 className="font-serif text-xl font-semibold text-primary">{name}</h3>
    <div className="mt-3 flex items-baseline gap-1">
      <span className="font-serif text-4xl font-semibold text-primary">₹{price}</span>
      <span className="text-sm text-muted-foreground">{period}</span>
    </div>
    <Button asChild className="mt-5 w-full" variant={highlight ? "default" : "outline"}>
      <Link to="/auth?mode=signup">Start 7-day trial</Link>
    </Button>
    <ul className="mt-6 space-y-2.5 text-sm">
      {features.map(f => (
        <li key={f} className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
          <span className="text-foreground">{f}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Faq = ({ q, a }: { q: string; a: string }) => (
  <div className="rounded-lg border border-border/60 bg-card p-5">
    <h4 className="font-serif text-lg font-semibold text-primary">{q}</h4>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
  </div>
);

export default Index;
