/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface MarketplaceItem {
  id: string;
  name: string;
  type: "API" | "AI Skill";
  provider: string;
  description: string;
  endpoint: string;
  latency: string;
  uptime: string;
  pricing: string;
}

const PLACEHOLDER_ITEMS: MarketplaceItem[] = [
  {
    id: "sec-audit-skill",
    name: "Solidity Sentinel",
    type: "AI Skill",
    provider: "OpenAudit Labs",
    description:
      "Automated smart contract vulnerability scanner verifying AST trees, reentrancy vulnerabilities, and gas optimizations.",
    endpoint: "POST /v1/skills/solidity/audit",
    latency: "340ms",
    uptime: "99.98%",
    pricing: "$0.02 / run",
  },
  {
    id: "fx-feed-api",
    name: "Global FX Matrix",
    type: "API",
    provider: "Apex Treasury",
    description:
      "Ultra-low latency spot and forward currency exchange quotes across 168 fiat currencies with sub-millisecond updates.",
    endpoint: "GET /v1/markets/fx/rates",
    latency: "18ms",
    uptime: "99.99%",
    pricing: "$12 / 100k calls",
  },
  {
    id: "doc-extract-skill",
    name: "DocuSchema Engine",
    type: "AI Skill",
    provider: "Kubo Core",
    description:
      "Multi-modal extraction pipeline returning strictly validated JSON schemas from complex invoices, bill of ladings, and receipts.",
    endpoint: "POST /v1/skills/vision/extract",
    latency: "520ms",
    uptime: "99.95%",
    pricing: "$0.015 / page",
  },
  {
    id: "semantic-embed-api",
    name: "Cross-Modal Vectorizer",
    type: "API",
    provider: "Tensorscale",
    description:
      "High-throughput text and image vector embeddings optimized for cosine similarity searches across distributed vector stores.",
    endpoint: "POST /v1/embeddings/cross-modal",
    latency: "42ms",
    uptime: "99.99%",
    pricing: "$0.0001 / 1k tokens",
  },
  {
    id: "agent-research-skill",
    name: "Deep Fact Verifier",
    type: "AI Skill",
    provider: "TruthLayer",
    description:
      "Autonomous claim verification synthesizing multi-source web evidence with cited references and confidence calibration.",
    endpoint: "POST /v1/skills/research/verify",
    latency: "890ms",
    uptime: "99.92%",
    pricing: "$0.04 / query",
  },
  {
    id: "weather-radar-api",
    name: "Atmospheric Nowcast",
    type: "API",
    provider: "DopplerMesh",
    description:
      "High-resolution microclimate predictions and live doppler radar feeds updated at 60-second intervals worldwide.",
    endpoint: "GET /v1/weather/microclimate",
    latency: "28ms",
    uptime: "99.99%",
    pricing: "$8 / 50k calls",
  },
];

export default function App() {
  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#1C1917] selection:bg-[#1F7A5A] selection:text-white">
      {/* Top Header */}
      <header className="border-b border-[#E7E5E4] bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-[#1C1917]">
              APIKUBO
            </span>
            <span className="hidden sm:inline-block text-xs uppercase tracking-widest text-[#78716C] font-mono">
              Gateway v0.1.0
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-xs text-[#78716C]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#1F7A5A]"></span>
              <span className="font-mono">Gateway Online</span>
            </div>
            <a
              href="#explore"
              className="text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
            >
              Explore Registry
            </a>
            <a
              href="#docs"
              className="text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
            >
              Documentation
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-20 lg:py-28">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-widest text-[#1F7A5A] font-semibold mb-4">
            Unified Registry & Execution Gateway
          </div>
          <h1 className="font-['Space_Grotesk'] text-5xl sm:text-6xl font-bold tracking-tight text-[#1C1917] leading-[1.1] mb-6">
            APIs & AI Skills. One home.
          </h1>
          <p className="font-['DM_Sans'] text-lg sm:text-xl text-[#78716C] leading-relaxed mb-10">
            A global marketplace and unified gateway for production-grade APIs
            and autonomous AI skills. Route, meter, and invoke capabilities
            with guaranteed latency budgets and single-key authentication.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <a
              href="#explore"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-lg bg-[#1F7A5A] hover:bg-[#17624A] text-white font-medium transition-colors shadow-xs"
            >
              Explore Catalog
            </a>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#E7E5E4] bg-[#FFFFFF] font-mono text-xs text-[#78716C]">
              <span className="text-[#1F7A5A] font-semibold">$</span>
              <span>curl -H &quot;Authorization: Bearer kubo_live_...&quot;</span>
            </div>
          </div>
        </div>

        {/* Feature / Metas Row */}
        <div className="mt-16 pt-8 border-t border-[#E7E5E4] grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <div className="font-['Space_Grotesk'] text-2xl font-bold text-[#1C1917]">
              &lt; 20ms
            </div>
            <div className="text-xs text-[#78716C] mt-1">Gateway Overhead</div>
          </div>
          <div>
            <div className="font-['Space_Grotesk'] text-2xl font-bold text-[#1C1917]">
              100%
            </div>
            <div className="text-xs text-[#78716C] mt-1">Server-Side Limits</div>
          </div>
          <div>
            <div className="font-['Space_Grotesk'] text-2xl font-bold text-[#1C1917]">
              Single Key
            </div>
            <div className="text-xs text-[#78716C] mt-1">Cross-Provider Auth</div>
          </div>
          <div>
            <div className="font-['Space_Grotesk'] text-2xl font-bold text-[#1C1917]">
              Schema Validated
            </div>
            <div className="text-xs text-[#78716C] mt-1">Deterministic Output</div>
          </div>
        </div>

        {/* Placeholder Card Grid Section */}
        <section id="explore" className="mt-20">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-8 pb-4 border-b border-[#E7E5E4]">
            <div>
              <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-[#1C1917]">
                Featured Services & Capabilities
              </h2>
              <p className="text-sm text-[#78716C] mt-1">
                Verified API endpoints and autonomous execution skills ready for integration.
              </p>
            </div>
            <div className="mt-3 sm:mt-0 text-xs font-mono text-[#78716C]">
              Showing {PLACEHOLDER_ITEMS.length} indexed endpoints
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLACEHOLDER_ITEMS.map((item) => (
              <article
                key={item.id}
                className="group rounded-xl border border-[#E7E5E4] bg-[#FFFFFF] p-6 flex flex-col justify-between hover:border-[#1F7A5A] transition-all hover:shadow-xs"
              >
                <div>
                  {/* Clean unboxed metadata header without pill badges */}
                  <div className="flex items-center justify-between text-xs text-[#78716C] mb-3">
                    <span className="font-medium text-[#1C1917]">{item.provider}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className={item.type === "AI Skill" ? "text-[#D97706]" : "text-[#1F7A5A]"}>
                        {item.type}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-['Space_Grotesk'] text-xl font-bold text-[#1C1917] group-hover:text-[#1F7A5A] transition-colors mb-2">
                    {item.name}
                  </h3>

                  <p className="font-['DM_Sans'] text-sm text-[#78716C] leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                <div>
                  {/* Code snippet showing endpoint */}
                  <div className="mb-4 rounded-md bg-[#FAF8F3] border border-[#E7E5E4] px-3 py-2 font-mono text-xs text-[#1C1917] truncate">
                    {item.endpoint}
                  </div>

                  {/* Operational stats separated by clean typographic dots */}
                  <div className="pt-4 border-t border-[#E7E5E4] flex items-center justify-between text-xs text-[#78716C]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{item.latency}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{item.uptime}</span>
                    </div>
                    <span className="font-medium text-[#1C1917] font-mono">
                      {item.pricing}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E7E5E4] bg-[#FFFFFF] mt-24 py-12">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#78716C]">
          <div className="flex items-center gap-3">
            <span className="font-['Space_Grotesk'] font-bold text-sm text-[#1C1917]">
              APIKUBO
            </span>
            <span aria-hidden="true">·</span>
            <span>Gateway-First Marketplace</span>
            <span aria-hidden="true">·</span>
            <span>Light Theme Baseline</span>
          </div>
          <div>
            Built with Next.js 14, TypeScript &amp; Tailwind CSS v4
          </div>
        </div>
      </footer>
    </div>
  );
}
