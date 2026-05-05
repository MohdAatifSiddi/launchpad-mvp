import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, FileText, ShieldCheck, ScrollText, Lock, Gavel, Check, Quote } from "lucide-react";

const themeStyle: React.CSSProperties & Record<string, string> = {
  ["--background"]: "201 100% 13%",
  ["--foreground"]: "0 0% 100%",
  ["--muted-foreground"]: "240 4% 66%",
  ["--primary"]: "0 0% 100%",
  ["--primary-foreground"]: "0 0% 4%",
  ["--secondary"]: "0 0% 10%",
  ["--muted"]: "0 0% 10%",
  ["--accent"]: "0 0% 100%",
  ["--accent-foreground"]: "0 0% 4%",
  ["--card"]: "201 80% 9%",
  ["--card-foreground"]: "0 0% 100%",
  ["--border"]: "0 0% 18%",
  ["--input"]: "0 0% 18%",
  fontFamily: "'Inter', sans-serif",
};

const serif = { fontFamily: "'Instrument Serif', serif" };

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

const Index = () => {
  return (
    <div style={themeStyle} className="min-h-screen w-full bg-background text-foreground">
      {/* ===== HERO with fullscreen video ===== */}
      <div className="relative min-h-screen w-full overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 z-0 h-full w-full object-cover"
          src={VIDEO_SRC}
        />
        <div className="absolute inset-0 z-0 bg-background/40" />

        {/* Nav */}
        <nav className="relative z-10 mx-auto flex max-w-7xl flex-row items-center justify-between px-8 py-6">
          <Link to="/" className="text-3xl tracking-tight text-foreground" style={serif}>
            Weybre<sup className="text-xs"> AI</sup>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#" className="text-sm text-foreground transition-colors">Home</a>
            <a href="#product" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Product</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
            <a href="#faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">FAQ</a>
            <Link to="/auth" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
          </div>
          <Link
            to="/auth?mode=signup"
            className="liquid-glass rounded-full px-6 py-2.5 text-sm text-foreground hover:scale-[1.03]"
          >
            Begin Trial
          </Link>
        </nav>

        {/* Hero copy */}
        <section className="relative z-10 flex flex-col items-center px-6 pt-24 pb-32 text-center md:pt-32 md:pb-40">
          <h1
            style={{ ...serif, letterSpacing: "-2.46px" }}
            className="animate-fade-rise max-w-7xl text-5xl font-normal leading-[0.95] sm:text-7xl md:text-8xl"
          >
            Where <em className="not-italic text-muted-foreground">precedent</em> meets the{" "}
            <em className="not-italic text-muted-foreground">speed of thought.</em>
          </h1>
          <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Weybre AI is the AI co-counsel for Indian advocates. Search the Supreme Court corpus, draft contracts grounded in real precedent, and turn eight hours of research into eight cited minutes.
          </p>
          <div className="animate-fade-rise-delay-2 mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/auth?mode=signup"
              className="liquid-glass cursor-pointer rounded-full px-14 py-5 text-base text-foreground hover:scale-[1.03]"
            >
              Begin Trial — ₹999/mo
            </Link>
            <a
              href="#product"
              className="rounded-full px-6 py-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              See how it works <ArrowRight className="ml-1 inline h-4 w-4" />
            </a>
          </div>
          <p className="animate-fade-rise-delay-2 mt-6 text-xs text-muted-foreground">
            Card required · Cancel anytime · GST invoice included
          </p>
        </section>
      </div>

      {/* ===== Trust strip ===== */}
      <section className="relative border-y border-border/40 bg-background/60 py-6 backdrop-blur-sm">
        <div className="container flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>🇮🇳 DPDP-aligned data residency</span>
          <span className="opacity-40">•</span>
          <span>Supreme Court of India · 18,000+ judgments</span>
          <span className="opacity-40">•</span>
          <span>25 High Courts on roadmap</span>
          <span className="opacity-40">•</span>
          <span>BCI-aware disclosures</span>
        </div>
      </section>

      {/* ===== Product ===== */}
      <section id="product" className="container py-24">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">The Product</p>
          <h2 style={serif} className="text-4xl leading-tight text-foreground md:text-6xl">
            Three modules. <em className="not-italic text-muted-foreground">One quiet workspace.</em>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every answer grounded in cited judgments. Every clause backed by precedent. No black boxes, no hallucinated citations.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<BookOpenCheck className="h-5 w-5" />}
            tag="Case-law"
            title="Ask in plain English. Get cited Indian case law."
            bullets={[
              "Hybrid semantic + keyword search over the SC corpus",
              "Streaming AI answers with inline citation chips",
              "Save research notes to matters, export to PDF or DOCX",
            ]}
          />
          <FeatureCard
            icon={<ScrollText className="h-5 w-5" />}
            tag="Web search"
            title="Live, cited search across the open legal web."
            bullets={[
              "Grounded with Gemini google_search tool — no extra keys",
              "Bare acts, gazettes, court orders and legal news",
              "Every answer carries the URL and the quoted excerpt",
            ]}
          />
          <FeatureCard
            icon={<FileText className="h-5 w-5" />}
            tag="Draft Assist"
            title="Draft Indian contracts grounded in precedent."
            bullets={[
              "NDA, Employment, Service, Notice, Reply, Vakalatnama",
              "Upload a draft — get clause-level risk flags & rewrites",
              "'Cite a precedent' backed by real SC judgments",
            ]}
          />
        </div>
      </section>

      {/* ===== Pillars ===== */}
      <section className="relative border-y border-border/40 bg-background/60 py-24">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Trust pillars</p>
            <h2 style={serif} className="text-4xl text-foreground md:text-5xl">
              Built for the <em className="not-italic text-muted-foreground">courtroom standard.</em>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Pillar icon={<ShieldCheck className="h-5 w-5" />} title="Honest by default" body="Every AI output shows ‘Verify before filing’. Every citation is clickable to its source." />
            <Pillar icon={<ScrollText className="h-5 w-5" />} title="Indian citation format" body="Outputs use the neutral citation system (e.g. 2023 INSC 1043) accepted in Indian courts." />
            <Pillar icon={<Lock className="h-5 w-5" />} title="DPDP-compliant" body="Your matters and queries stay private. One-click delete-my-data in Settings." />
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="container py-24">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">How it works</p>
          <h2 style={serif} className="text-4xl text-foreground md:text-5xl">From query to citation in three steps.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Step n={1} title="Ask" body="Type a legal question — in English or Hindi — the way you'd ask a junior associate." />
          <Step n={2} title="Retrieve" body="Hybrid search pulls the most relevant SC judgments and live web sources." />
          <Step n={3} title="Answer" body="A grounded answer with inline citations, direct quotes, and a clear reasoning trail." />
        </div>

        {/* Sample citation card */}
        <div className="mx-auto mt-14 max-w-xl">
          <div className="liquid-glass rounded-2xl p-6">
            <div className="mb-2 flex items-center gap-2">
              <Quote className="h-4 w-4 text-foreground" />
              <span className="text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground">Cited answer</span>
            </div>
            <p style={serif} className="text-xl leading-snug text-foreground">
              "Specific performance was denied due to inordinate delay in seeking relief…"
            </p>
            <p className="mt-3 text-[0.7rem] tracking-wider text-muted-foreground">2023 INSC 1043 · Para 27</p>
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="relative border-y border-border/40 bg-background/60 py-24">
        <div className="container">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Pricing</p>
            <h2 style={serif} className="text-4xl text-foreground md:text-5xl">
              Honest, <em className="not-italic text-muted-foreground">paid-only</em> pricing.
            </h2>
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
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="container py-24">
        <div className="mx-auto max-w-3xl">
          <h2 style={serif} className="mb-12 text-center text-4xl text-foreground md:text-5xl">
            Honest answers to <em className="not-italic text-muted-foreground">honest questions.</em>
          </h2>
          <div className="space-y-4">
            <Faq q="Will Weybre AI hallucinate citations?" a="Our hybrid retrieval grounds every answer in real SC judgments and live web sources before the LLM responds. Every citation is clickable to its source. We deliberately surface ‘Verify before filing’ on every output — AI is a co-counsel, not a substitute." />
            <Faq q="Is my client data safe?" a="Yes. Your matters, drafts and queries are isolated per-account with row-level security. Data is hosted in India in alignment with the DPDP Act. You can delete all your data with one click in Settings." />
            <Faq q="Which sources are covered?" a="Case law: full Supreme Court of India corpus (2000–present), with High Courts rolling out month-by-month. Web: live, cited search across legal news, government portals, journals and bare acts." />
            <Faq q="What about the Bar Council and UPL rules?" a="Weybre AI is a productivity tool for licensed advocates. We collect your Bar Council number at signup, and every output carries a clear AI-generated disclosure. Weybre AI does not provide legal advice or solicit work from the public." />
            <Faq q="Can I cancel anytime?" a="Yes. Self-serve cancellation in Settings. You keep access through the end of the billing period and can export your matters before leaving." />
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="container py-24">
        <div className="liquid-glass relative overflow-hidden rounded-3xl p-12 text-center md:p-20">
          <Gavel className="mx-auto mb-6 h-8 w-8 text-foreground" />
          <h2 style={serif} className="text-4xl text-foreground md:text-6xl">
            Win back your <em className="not-italic text-muted-foreground">evenings.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Subscribe securely with Dodo Payments. No call, no demo. Open the app and start researching.
          </p>
          <Link
            to="/auth?mode=signup"
            className="liquid-glass mt-10 inline-block cursor-pointer rounded-full px-14 py-5 text-base text-foreground hover:scale-[1.03]"
          >
            Subscribe — ₹999 / month
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border/40 py-12">
        <div className="container flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Link to="/" className="text-2xl tracking-tight text-foreground" style={serif}>
              Weybre<sup className="text-xs"> AI</sup>
            </Link>
            <p className="mt-3 max-w-md text-xs text-muted-foreground">
              Weybre AI is a legal research and drafting productivity tool for Indian advocates. Outputs are AI-generated and must be independently verified by a licensed advocate before any filing or advice. Weybre AI does not constitute legal advice and does not solicit work in violation of the Bar Council of India Rules.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground md:justify-end">
            <Link to="/legal/about" className="hover:text-foreground">About</Link>
            <Link to="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/legal/refund" className="hover:text-foreground">Refunds</Link>
            <Link to="/legal/disclaimer" className="hover:text-foreground">Disclaimer</Link>
            <Link to="/legal/contact" className="hover:text-foreground">Contact</Link>
            <span>© {new Date().getFullYear()} Weybre AI · Made in India</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, tag, title, bullets }: { icon: React.ReactNode; tag: string; title: string; bullets: string[] }) => (
  <div className="liquid-glass rounded-2xl p-7">
    <div className="mb-5 flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/10 text-foreground">{icon}</span>
      <span className="text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground">{tag}</span>
    </div>
    <h3 style={serif} className="text-2xl leading-snug text-foreground">{title}</h3>
    <ul className="mt-5 space-y-2.5 text-sm">
      {bullets.map(b => (
        <li key={b} className="flex items-start gap-2 text-muted-foreground">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Pillar = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="liquid-glass rounded-2xl p-6">
    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-foreground/10 text-foreground">{icon}</div>
    <h4 style={serif} className="text-xl text-foreground">{title}</h4>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
  </div>
);

const Step = ({ n, title, body }: { n: number; title: string; body: string }) => (
  <div className="liquid-glass rounded-2xl p-7">
    <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-sm text-foreground" style={serif}>{n}</div>
    <h4 style={serif} className="text-2xl text-foreground">{title}</h4>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
  </div>
);

const PriceCard = ({ name, price, period, features, highlight }: { name: string; price: string; period: string; features: string[]; highlight: boolean }) => (
  <div className={`liquid-glass relative rounded-2xl p-8 ${highlight ? "ring-1 ring-foreground/30" : ""}`}>
    {highlight && (
      <span className="absolute -top-3 left-7 rounded-full bg-foreground px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-background">
        Most popular
      </span>
    )}
    <h3 style={serif} className="text-2xl text-foreground">{name}</h3>
    <div className="mt-3 flex items-baseline gap-1">
      <span style={serif} className="text-5xl text-foreground">₹{price}</span>
      <span className="text-sm text-muted-foreground">{period}</span>
    </div>
    <Link
      to="/auth?mode=signup"
      className="liquid-glass mt-6 block w-full cursor-pointer rounded-full px-6 py-3 text-center text-sm text-foreground hover:scale-[1.02]"
    >
      Start 7-day trial
    </Link>
    <ul className="mt-6 space-y-2.5 text-sm">
      {features.map(f => (
        <li key={f} className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
          <span className="text-muted-foreground">{f}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Faq = ({ q, a }: { q: string; a: string }) => (
  <div className="liquid-glass rounded-2xl p-6">
    <h4 style={serif} className="text-xl text-foreground">{q}</h4>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
  </div>
);

export default Index;
