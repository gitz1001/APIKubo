import type { OwnedListing, Plan } from "./types";

/**
 * Demo catalog used when Supabase is not configured. Providers and endpoints are
 * fictional (.example domains) — clearly labelled as demo data in the UI.
 */
interface SeedSpec {
  n: number;
  name: string;
  slug: string;
  type: OwnedListing["type"];
  category: string;
  provider: string;
  providerName: string;
  tagline: string;
  description: string;
  upvotes: number;
  paid: { name: string; cents: number; rpm: number; quota: number };
}

const SPECS: SeedSpec[] = [
  {
    n: 1, name: "Solidity Sentinel", slug: "solidity-sentinel", type: "ai_skill", category: "security",
    provider: "openaudit", providerName: "OpenAudit Labs", upvotes: 214,
    tagline: "Smart-contract vulnerability scanning with reentrancy and gas findings.",
    description:
      "Submit Solidity source or verified contract addresses and receive structured findings: reentrancy paths, unchecked calls, access-control gaps and gas optimisations, each with severity and a suggested patch.",
    paid: { name: "Auditor", cents: 4900, rpm: 120, quota: 20_000 },
  },
  {
    n: 2, name: "Global FX Matrix", slug: "global-fx-matrix", type: "api", category: "finance",
    provider: "apex-treasury", providerName: "Apex Treasury", upvotes: 188,
    tagline: "Spot and forward FX quotes across 168 fiat currencies.",
    description:
      "Low-latency spot, forward and historical exchange rates with mid, bid and ask. Supports batch conversion and ISO 4217 metadata.",
    paid: { name: "Desk", cents: 2900, rpm: 600, quota: 500_000 },
  },
  {
    n: 3, name: "DocuSchema Engine", slug: "docuschema", type: "ai_skill", category: "documents",
    provider: "kubo-core", providerName: "Kubo Core", upvotes: 167,
    tagline: "Invoices, receipts and bills of lading to validated JSON.",
    description:
      "Multi-modal extraction that returns JSON validated against your schema. Every field carries a confidence score and a bounding box so low-confidence values can be routed to review.",
    paid: { name: "Pipeline", cents: 3900, rpm: 300, quota: 100_000 },
  },
  {
    n: 4, name: "Cross-Modal Vectorizer", slug: "cross-modal-vectorizer", type: "api", category: "ai",
    provider: "tensorscale", providerName: "Tensorscale", upvotes: 142,
    tagline: "Text and image embeddings in one vector space.",
    description:
      "High-throughput embeddings for text and images that share a vector space, tuned for cosine similarity search across common vector stores.",
    paid: { name: "Scale", cents: 1900, rpm: 1200, quota: 2_000_000 },
  },
  {
    n: 5, name: "Deep Fact Verifier", slug: "deep-fact-verifier", type: "ai_skill", category: "ai",
    provider: "truthlayer", providerName: "TruthLayer", upvotes: 121,
    tagline: "Claim verification with cited sources and calibrated confidence.",
    description:
      "Send a claim; receive a verdict, the evidence used, citations and a calibrated confidence score. Designed as a tool for research agents.",
    paid: { name: "Research", cents: 5900, rpm: 60, quota: 10_000 },
  },
  {
    n: 6, name: "Atmospheric Nowcast", slug: "atmospheric-nowcast", type: "api", category: "geo",
    provider: "dopplermesh", providerName: "DopplerMesh", upvotes: 97,
    tagline: "Minute-level microclimate forecasts and radar tiles.",
    description:
      "Hyperlocal precipitation and temperature nowcasts refreshed every 60 seconds, plus radar tiles for map overlays.",
    paid: { name: "Ops", cents: 1500, rpm: 600, quota: 1_000_000 },
  },
];

const pad = (n: number, width = 12) => String(n).padStart(width, "0");
const CREATED = "2026-10-01T09:00:00.000Z";

function plan(listingId: string, id: string, name: string, cents: number, rpm: number, quota: number, features: string[]): Plan {
  return { id, listing_id: listingId, name, description: null, price_cents: cents, rate_limit_rpm: rpm, quota_monthly: quota, features, is_active: true };
}

export function buildSeedListings(): OwnedListing[] {
  return SPECS.map((spec) => {
    const id = `5eed0000-0000-4000-8000-${pad(spec.n)}`;
    return {
      id,
      user_id: `5eed0000-0000-4000-9000-${pad(spec.n)}`,
      name: spec.name,
      slug: spec.slug,
      tagline: spec.tagline,
      description: spec.description,
      type: spec.type,
      status: "published",
      category: spec.category,
      base_url: `https://api.${spec.provider}.example/v1`,
      documentation_url: null,
      upvote_count: spec.upvotes,
      created_at: CREATED,
      updated_at: CREATED,
      provider: { username: spec.provider, display_name: spec.providerName },
      plans: [
        plan(id, `5eed0000-0000-4000-a000-${pad(spec.n * 10 + 1)}`, "Free", 0, 30, 1_000, ["Community support"]),
        plan(id, `5eed0000-0000-4000-a000-${pad(spec.n * 10 + 2)}`, spec.paid.name, spec.paid.cents, spec.paid.rpm, spec.paid.quota,
          ["Email support", "Usage analytics"]),
      ],
    };
  });
}
