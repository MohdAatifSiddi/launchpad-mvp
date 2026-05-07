import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Mail, MapPin } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const UPDATED = "26 April 2026";

const pages = {
  about: {
    title: "About Weybre AI",
    intro: "Weybre AI is a legal research and drafting productivity platform built for Indian advocates and law firms.",
    sections: [
      { h: "What we build", p: "The product helps legal professionals search Indian legal materials, review uploaded documents, create drafts, manage matters, and export work product. AI output is designed to assist legal work, not replace professional judgment." },
      { h: "Who it is for", p: "Weybre AI is intended for licensed advocates, law firms, in-house legal teams, and legal operations professionals. It is not intended to provide direct legal advice to the public." },
      { h: "Our standard", p: "We prioritize cited answers, document-grounded review, auditability, user-controlled data, and clear AI disclosures across research and drafting workflows." },
    ],
  },
  terms: {
    title: "Terms of Service",
    intro: "These terms govern access to and use of Weybre AI, including paid subscriptions, research, drafting, uploads, exports, and related services.",
    sections: [
      { h: "Eligibility", p: "You must be legally competent to contract and, where using advocate-facing features, a licensed legal professional or authorized member of a legal organization." },
      { h: "Professional responsibility", p: "AI-generated content must be independently reviewed before filing, sending, advising, relying on, or sharing with clients, courts, counterparties, or regulators." },
      { h: "Accounts and security", p: "You are responsible for maintaining account confidentiality, restricting access to your workspace, and promptly notifying us of unauthorized use." },
      { h: "Acceptable use", p: "You may not use the service for illegal activity, unauthorized legal solicitation, spam, malware, infringement, scraping abuse, model extraction, or attempts to bypass security controls." },
      { h: "Subscriptions", p: "Paid plans renew monthly unless cancelled. Access may be limited or suspended if payment fails, chargebacks occur, or usage violates these terms." },
      { h: "Intellectual property", p: "You retain rights in your uploaded documents and generated drafts, subject to your responsibility to verify and clear third-party rights. Weybre AI retains rights in the platform, software, models, workflows, and branding." },
      { h: "Service changes", p: "We may improve, modify, suspend, or discontinue features to maintain security, compliance, reliability, and product quality." },
      { h: "Limitation of liability", p: "To the maximum extent permitted by law, Weybre AI is provided on an as-is basis and liability is limited to fees paid for the service during the relevant billing period." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: "This policy explains how Weybre AI handles account data, uploaded documents, research queries, drafts, billing metadata, and support communications.",
    sections: [
      { h: "Information we process", p: "We process account details, profile information, subscription status, legal queries, matters, drafts, uploaded document text, usage events, device metadata, and support communications." },
      { h: "Purpose of processing", p: "We use data to provide the product, secure accounts, process payments, generate AI-assisted outputs, improve reliability, provide support, prevent misuse, and comply with legal obligations." },
      { h: "Client and matter data", p: "Your matter data, drafts, and uploaded documents are private to your authenticated workspace and protected by access controls. Do not upload material unless you have authority to process it." },
      { h: "AI processing", p: "Uploaded and entered content may be sent to AI systems solely to generate requested research, review, drafting, and summarization outputs within the product workflow." },
      { h: "Retention and deletion", p: "You may delete matters, drafts, notes, and usage data from Settings. Some billing, tax, security, and legal records may be retained where required by law or legitimate business needs." },
      { h: "Security", p: "We use authenticated access, private storage, database access rules, and server-side secret handling. No internet system can be guaranteed perfectly secure." },
      { h: "Your rights", p: "Depending on applicable law, including India’s DPDP framework, you may request access, correction, deletion, grievance review, or withdrawal where legally available." },
    ],
  },
  refund: {
    title: "Cancellation & Refund Policy",
    intro: "This policy explains subscription cancellation, failed payments, and refund handling for Weybre AI plans.",
    sections: [
      { h: "Cancellation", p: "You can cancel from Settings. Cancellation is scheduled through Dodo Payments and access may continue until the end of the current billing period unless otherwise stated." },
      { h: "Refunds", p: "Subscription fees are generally non-refundable once a billing period begins, except where required by law or where we determine there was duplicate billing, payment error, or service failure attributable to us." },
      { h: "Failed payments", p: "If payment fails, access may be marked past due and limited until a successful payment is completed." },
      { h: "Plan changes", p: "Plan upgrades or downgrades may apply from the current or next billing cycle depending on billing provider behavior and product configuration." },
      { h: "How to request help", p: "For billing issues, contact support with your account email, payment date, amount, and Dodo Payments payment reference if available." },
    ],
  },
  disclaimer: {
    title: "Legal & AI Disclaimer",
    intro: "Weybre AI is an assistive technology product. It is not a lawyer, law firm, court filing service, or substitute for professional legal judgment.",
    sections: [
      { h: "No legal advice", p: "Outputs are AI-generated information and drafting assistance for legal professionals. They do not constitute legal advice to any person or create an advocate-client relationship." },
      { h: "Verification required", p: "All citations, authorities, facts, clauses, deadlines, procedural positions, and legal conclusions must be independently verified before use." },
      { h: "Court and regulator use", p: "Before filing or presenting AI-assisted work, users must comply with court rules, professional conduct duties, confidentiality obligations, and applicable disclosure requirements." },
      { h: "No solicitation", p: "The product is not intended to solicit legal work from the public or advertise legal services in violation of Bar Council of India rules." },
    ],
  },
  security: {
    title: "Security",
    intro: "Weybre AI is built with security-first defaults: authenticated workspaces, row-level isolation, encrypted secrets, and DPDP-aligned data residency.",
    sections: [
      { h: "Data residency", p: "Customer data is hosted on managed infrastructure in alignment with the Digital Personal Data Protection Act, 2023 (DPDP). Matters, drafts, and queries remain inside your authenticated workspace." },
      { h: "Encryption", p: "Data is encrypted in transit using TLS 1.2+. Data at rest is encrypted using industry-standard AES-256. Backups are encrypted and access-controlled." },
      { h: "Access control", p: "Every record is protected by row-level security tied to the authenticated user. Admin operations require an explicit admin role granted in our access table — no client-side role checks." },
      { h: "Secret management", p: "Provider keys (Indian Kanoon, Dodo Payments, AI gateway) are stored as server-side secrets and only accessed inside trusted backend functions. No private keys are exposed to the browser." },
      { h: "Authentication", p: "Sign-in is protected by industry-standard email/password flows with optional Google sign-in. Sessions are short-lived and refreshed via secure tokens." },
      { h: "Auditability", p: "Billing events, usage events, and admin actions are logged server-side. Admins can review payment, subscription, and usage history from the admin dashboard." },
      { h: "Responsible disclosure", p: "If you discover a vulnerability, email security@weybre.ai with reproduction details. We acknowledge reports within 72 hours and credit responsible reporters in our hall of fame." },
      { h: "Subprocessors", p: "We use vetted subprocessors for hosting, payments (Dodo Payments), AI inference (Lovable AI Gateway), and legal data (Indian Kanoon). A current list is available on request." },
      { h: "Your controls", p: "Delete matters, drafts, and notes from Settings at any time. Contact us for a full data export or account erasure under the DPDP Act." },
    ],
  },
  contact: {
    title: "Contact & Grievance",
    intro: "For product, billing, privacy, or grievance requests, contact the Weybre AI team using the details below.",
    sections: [
      { h: "Email", p: "support@weybre.ai" },
      { h: "Billing support", p: "Include your account email, plan, payment date, amount, and Dodo Payments payment reference where available." },
      { h: "Privacy or deletion requests", p: "Use the in-app delete option where available, or contact support with sufficient account verification details." },
      { h: "Registered office", p: "Weybre AI, Bengaluru, Karnataka, India. Replace this placeholder with your final legal entity and registered address before launch." },
    ],
  },
} as const;

const Legal = () => {
  const { slug = "about" } = useParams<{ slug: keyof typeof pages }>();
  const page = pages[slug as keyof typeof pages] ?? pages.about;

  return (
    <div className="min-h-screen bg-hero">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Button asChild variant="outline" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
        </div>
      </header>
      <main className="container max-w-4xl py-12">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Updated {UPDATED}</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-primary md:text-5xl">{page.title}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
        <div className="mt-10 space-y-6">
          {page.sections.map((section) => (
            <section key={section.h} className="border-b border-border/60 pb-6 last:border-b-0">
              <h2 className="font-serif text-xl font-semibold text-primary">{section.h}</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{section.p}</p>
            </section>
          ))}
        </div>
        {slug === "contact" && (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5"><Mail className="mb-3 h-5 w-5 text-accent" /><p className="font-medium text-primary">support@weybre.ai</p></div>
            <div className="rounded-lg border border-border bg-card p-5"><MapPin className="mb-3 h-5 w-5 text-accent" /><p className="font-medium text-primary">Bengaluru, Karnataka, India</p></div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Legal;
