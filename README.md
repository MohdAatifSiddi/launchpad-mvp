
# NyayAI Research MVP — Pre-Seed & First 100 Paying Lawyers

## Beachhead
**AI-powered case-law research for solo lawyers + small firms (1–10) in India.** Paid-only from day one. Indian Supreme Court corpus (your uploaded ~18K judgments) powers semantic search, AI answers with citations, and grounds a lightweight drafting assist.

## Core User Flow
1. Lawyer lands on marketing page → "Start 7-day paid trial — ₹999/month" → Razorpay checkout (card required).
2. Onboarding: name, firm, practice areas, bar council number (for trust + future BCI compliance).
3. **Research workspace** opens — the heart of the product.

## Feature Set (MVP)

### 1. Research Workspace (primary surface)
- **Ask in plain English/Hindi**: "Find SC judgments where specific performance was denied due to delay" → AI answer with cited cases, reasoning, and direct quotes.
- **Semantic + keyword hybrid search** over the Indian SC corpus (embeddings + Postgres full-text).
- **Case detail view**: title, date, bench, judges, disposal, AI-generated summary, "issues for consideration", related judgments.
- **Save to Matter**: organize cases into named matters/research folders.
- **Export**: copy citation, export research note as PDF/DOCX with proper Indian citation format (e.g., 2023 INSC 1043).
- **Streaming AI answers** with visible "Reasoning…" state and inline citation chips that scroll to the source.

### 2. Draft Assist (lean, grounded in case law)
- 6 starter templates: NDA, Employment Agreement, Service Agreement, Legal Notice, Reply Notice, Vakalatnama.
- Chat-driven drafting: AI asks for parties, jurisdiction, key terms, then generates a clause-by-clause draft.
- **Risk flags**: each clause shows a confidence chip + plain-English risk note.
- **"Cite a precedent"**: pulls relevant SC judgments from the corpus to support specific clauses.
- Export to DOCX / PDF.

### 3. Matters (light workspace)
- Create matters → attach research notes, drafts, uploaded reference PDFs.
- Single-user only in MVP (team seats = v2).

### 4. Account & Billing
- Razorpay subscription (₹999/mo Solo, ₹2,499/mo Firm-3 seats) — paid trial, card required at signup.
- Usage meter: queries/month, drafts/month, with soft caps and clear upgrade nudge.
- Invoice download (GST-compliant), cancel/upgrade self-serve.

### 5. Marketing Landing Page
- Hero: "Turn 8 hours of legal research into 8 minutes."
- Live demo video, "Built for Indian Law" trust strip (SC + 25 HCs roadmap), founder note, pricing, FAQ, BCI/UPL disclaimer ("AI co-counsel — not a substitute for legal advice"), DPDP-compliance badge (data hosted in India).
- Single CTA everywhere: **Start paid trial**.

### 6. Trust & Compliance Layer
- Visible "AI-generated, verify before filing" badge on every AI output.
- Every cited case is clickable → source view (no hidden hallucinations).
- DPDP-friendly: data residency note, delete-my-data button in settings.
- Bar council number captured at signup (for future verification gating).

## Design Direction
- **Sober, premium, courtroom-credible** — not a flashy consumer app. Lawyers buy trust.
- Deep navy + ivory base, single saffron/gold accent (subtle nod to India), serif for headings (authority), clean sans for body.
- Devanagari "न्याय" mark in the logo lockup.
- Dense-but-readable case cards, generous whitespace in research answers, monospace for citations.
- Dark mode supported.

## Tech & Data Plan (handled in build)
- **Lovable Cloud** for auth (email + password + Google), Postgres, storage, edge functions.
- **Lovable AI Gateway** for LLM (Gemini for fast research answers, GPT-5 for drafting) — streaming responses.
- **Indian SC dataset** ingested into Postgres with `pgvector` embeddings; hybrid retrieval (vector + full-text) before LLM synthesis to minimize hallucination.
- **Razorpay** for INR subscriptions (you'll add the API keys when we get there).
- DOCX/PDF export via server-side generation.
- Roles table (`user_roles`) from day 1 — admin vs lawyer — for future firm seats.

## Out of Scope for MVP (deliberate)
- High Court corpora (roadmap; SC-only at launch is honest and ships fast)
- COMPLY module (RBI/SEBI tracker)
- Team collaboration / multi-seat firm workspaces
- Hindi/regional language UI (English UI; Hindi queries supported via LLM)
- Mobile app (responsive web only)

## What Investors Will See in the Demo
1. Lawyer asks a real Indian legal question → grounded, cited answer in <10s.
2. One-click drafts an NDA with case-law-backed clauses.
3. Razorpay dashboard showing real paying customers.
4. Usage analytics: queries/lawyer/week (the retention metric).

## Build Order
1. Auth, roles, billing-gated routing, landing page, Razorpay paid-trial signup.
2. Ingest SC dataset → embeddings → hybrid search API.
3. Research workspace (search → AI answer with citations → save to matter).
4. Matters + export to PDF/DOCX.
5. Draft Assist (6 templates, chat flow, risk flags, citation grounding).
6. Usage metering, invoices, settings, DPDP delete-my-data.
7. Polish, empty states, error states, analytics events for funnel.
