export interface PlaybookQuestion { label: string; prompt: string; expected_format?: string; }
export interface Playbook { key: string; name: string; description: string; questions: PlaybookQuestion[]; }

export const PLAYBOOKS: Playbook[] = [
  {
    key: "nda",
    name: "NDA / Confidentiality",
    description: "Standard NDA review — Indian commercial context",
    questions: [
      { label: "Parties", prompt: "Identify the disclosing party and receiving party with full legal names." },
      { label: "Effective date", prompt: "What is the effective date of the agreement?" },
      { label: "Term", prompt: "What is the duration of confidentiality obligations? Quote the exact clause." },
      { label: "Definition of Confidential Information", prompt: "Summarise how Confidential Information is defined and list any carve-outs." },
      { label: "Permitted use", prompt: "For what purpose is the receiving party permitted to use the information?" },
      { label: "Governing law", prompt: "What is the governing law and dispute resolution forum?" },
      { label: "Injunctive relief", prompt: "Does the agreement provide for injunctive relief? Quote." },
      { label: "Return / destruction", prompt: "What are the return or destruction obligations on termination?" },
    ],
  },
  {
    key: "lease",
    name: "Commercial Lease",
    description: "Indian commercial lease / leave & licence",
    questions: [
      { label: "Lessor & Lessee", prompt: "Names and addresses of lessor and lessee." },
      { label: "Premises", prompt: "Describe the demised premises with carpet/built-up area." },
      { label: "Term & lock-in", prompt: "Lease term, commencement date, and lock-in period." },
      { label: "Rent & escalation", prompt: "Monthly rent, escalation clause, and frequency." },
      { label: "Security deposit", prompt: "Security deposit amount, refund conditions, and interest." },
      { label: "Termination", prompt: "Termination rights and notice period for each party." },
      { label: "Maintenance & taxes", prompt: "Who bears maintenance, property tax, and statutory dues?" },
      { label: "Stamp duty & registration", prompt: "Is the deed registered? Stamp duty paid?" },
    ],
  },
  {
    key: "spa",
    name: "Share Purchase Agreement",
    description: "M&A — share purchase / SPA",
    questions: [
      { label: "Parties", prompt: "Buyer, seller, and target company." },
      { label: "Consideration", prompt: "Total consideration, payment mechanism, and adjustments." },
      { label: "Conditions precedent", prompt: "List the key conditions precedent to closing." },
      { label: "Reps & warranties cap", prompt: "Liability cap, basket, and survival period for warranties." },
      { label: "Indemnity", prompt: "Scope of indemnities and time limits. Quote." },
      { label: "Non-compete / non-solicit", prompt: "Restrictive covenants on the seller — duration and scope." },
      { label: "Governing law & arbitration", prompt: "Governing law, seat and venue of arbitration." },
      { label: "Change of control triggers", prompt: "Any change-of-control consequences referenced?" },
    ],
  },
  {
    key: "employment",
    name: "Employment Agreement",
    description: "Senior employment / appointment letter",
    questions: [
      { label: "Designation & start date", prompt: "Position, reporting line, and date of joining." },
      { label: "Compensation", prompt: "Fixed CTC, variable, ESOPs, and benefits." },
      { label: "Notice period", prompt: "Notice period for resignation and termination." },
      { label: "Non-compete", prompt: "Post-termination non-compete and non-solicit terms." },
      { label: "IP assignment", prompt: "Assignment of intellectual property created during employment." },
      { label: "Confidentiality", prompt: "Confidentiality obligations during and after employment." },
      { label: "Garden leave", prompt: "Is there a garden-leave clause? Quote." },
    ],
  },
  {
    key: "msa",
    name: "Vendor MSA / SaaS",
    description: "Master services agreement / SaaS contract",
    questions: [
      { label: "Scope of services", prompt: "Summarise the services or SaaS offering." },
      { label: "Fees & payment terms", prompt: "Fees, billing cycle, and payment terms." },
      { label: "SLA & credits", prompt: "Service levels and any service credits or remedies." },
      { label: "Liability cap", prompt: "Limitation of liability — cap and exclusions. Quote." },
      { label: "Data protection", prompt: "Data processing, security, and DPDP-related obligations." },
      { label: "IP ownership", prompt: "Ownership of pre-existing IP and deliverables." },
      { label: "Termination & exit", prompt: "Termination rights and data return on exit." },
      { label: "Governing law", prompt: "Governing law and dispute resolution forum." },
    ],
  },
];
