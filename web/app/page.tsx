import { ArrowRight, KeyRound, Search, Zap } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { ListingCard } from "@/components/ListingCard";
import { ui } from "@/components/ui";
import { gatewayUrl } from "@/lib/env";
import { getRepo } from "@/lib/server/repo";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

const FACTS = [
  { value: "1 key", label: "Works across every listing you subscribe to" },
  { value: "SHA-256", label: "Keys hashed at rest and shown only once" },
  { value: "Server-side", label: "Rate limits and quotas enforced in the gateway" },
  { value: "Per request", label: "Usage metered for providers and consumers" },
];

const STEPS = [
  { icon: Search, title: "Find a capability", body: "Browse APIs and AI Skills by category, price and popularity." },
  { icon: Zap, title: "Subscribe to a plan", body: "Start on a free tier in one click. Limits are shown up front." },
  { icon: KeyRound, title: "Call it with one key", body: "Create a key in your dashboard and send it to the gateway." },
];

export default async function HomePage() {
  let featured: Listing[] = [];
  let catalogError = false;
  try {
    featured = (await getRepo().listPublished()).slice(0, 6);
  } catch {
    catalogError = true;
  }
  const snippet = `curl ${gatewayUrl()}/v1/<listing>/<path> \\\n  -H "Authorization: Bearer $APIKUBO_KEY"`;

  return (
    <main>
      <section className={`${ui.container} grid gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24`}>
        <div>
          <p className={`${ui.eyebrow} mb-4`}>Marketplace + execution gateway</p>
          <h1 className="mb-6 text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-6xl">APIs &amp; AI Skills. One home.</h1>
          <p className="mb-10 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
            Discover production APIs and agent-ready skills, subscribe in a click, and call all of them through one
            gateway with one key. Providers get auth, rate limits and metering without writing any of it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/explore" className={`${ui.buttonPrimary} px-6 py-3`}>
              Explore the catalog <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/submit" className={`${ui.buttonSecondary} px-6 py-3`}>
              Publish your API
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-ink shadow-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <span className="font-mono text-[11px] text-stone-400">one key · every listing</span>
            <CopyButton value={snippet} className="text-stone-300 hover:bg-white/10 hover:text-white" />
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-stone-100 sm:text-sm">
            <code>{snippet}</code>
          </pre>
          <div className="border-t border-white/10 px-5 py-3 font-mono text-[11px] text-stone-400">
            ← X-RateLimit-Remaining · X-Quota-Remaining · X-Request-Id
          </div>
        </div>
      </section>

      <section className={`${ui.container}`}>
        <dl className="grid grid-cols-2 gap-6 border-t border-line pt-8 md:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact.value}>
              <dt className="font-heading text-2xl font-bold text-ink">{fact.value}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted">{fact.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={`${ui.container} mt-20`} aria-labelledby="how-title">
        <h2 id="how-title" className="mb-8 text-2xl font-bold text-ink">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className={`${ui.card} p-6`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <step.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-mono text-xs text-muted">Step {index + 1}</span>
              </div>
              <h3 className="mb-1 font-bold text-ink">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="explore" className={`${ui.container} mt-20`} aria-labelledby="featured-title">
        <div className="mb-8 flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-end">
          <div>
            <h2 id="featured-title" className="text-2xl font-bold text-ink">Popular right now</h2>
            <p className="mt-1 text-sm text-muted">The most upvoted APIs and AI Skills in the catalog.</p>
          </div>
          <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover">
            View all <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {catalogError ? (
          <p className={`${ui.card} p-8 text-center text-sm text-muted`}>The catalog is temporarily unavailable. Please try again shortly.</p>
        ) : featured.length === 0 ? (
          <div className={`${ui.card} p-10 text-center`}>
            <p className="mb-4 text-sm text-muted">No listings yet. Be the first to publish one.</p>
            <Link href="/submit" className={ui.buttonPrimary}>Publish a listing</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
