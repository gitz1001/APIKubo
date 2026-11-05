import { ArrowLeft, BookOpen, Check, ChevronUp, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CopyButton } from "@/components/CopyButton";
import { TypeTag } from "@/components/ListingCard";
import { SubscribeButton } from "@/components/SubscribeButton";
import { ui } from "@/components/ui";
import { gatewayUrl } from "@/lib/env";
import { categoryLabel, formatNumber, formatPrice } from "@/lib/format";
import { getSessionUser } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/repo";
import type { Listing, OwnedListing } from "@/lib/types";
import { SLUG_RE } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

// cache(): generateMetadata and the page share one set of queries per request.
const load = cache(async (slug: string) => {
  if (!SLUG_RE.test(slug)) return null;
  const repo = getRepo();
  const user = await getSessionUser();
  const [publicListing, owned] = await Promise.all([
    repo.getBySlug(slug),
    user ? repo.getOwnedBySlug(user.id, slug) : Promise.resolve(null),
  ]);
  const listing: Listing | null = owned ?? publicListing;
  if (!listing) return null;
  const subscriptions = user ? await repo.listSubscriptions(user.id) : [];
  const subscription = subscriptions.find(
    (s) => s.listing?.id === listing.id && (s.status === "active" || s.status === "trialing"),
  );
  return { listing, owned, user, subscription };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params.slug);
  if (!data) return { title: "Not found" };
  return { title: data.listing.name, description: data.listing.tagline ?? undefined };
}

export default async function ListingPage({ params }: Props) {
  const data = await load(params.slug);
  if (!data) notFound();
  const { listing, owned, user, subscription } = data;
  const plans = listing.plans.filter((p) => p.is_active);
  const endpoint = `${gatewayUrl()}/v1/${listing.slug}/`;
  const curl = `curl ${endpoint} \\\n  -H "Authorization: Bearer $APIKUBO_KEY"`;
  const loginHref = `/login?next=${encodeURIComponent(`/listings/${listing.slug}`)}`;

  return (
    <main className={`${ui.container} py-10`}>
      <Link href="/explore" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to catalog
      </Link>

      {owned && <OwnerNotice listing={owned} />}

      <header className="mb-10 border-b border-line pb-8">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted">
          <TypeTag type={listing.type} />
          <span>{categoryLabel(listing.category)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 font-mono">
            <ChevronUp className="h-3.5 w-3.5" aria-hidden /> {listing.upvote_count}
          </span>
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-ink sm:text-5xl">{listing.name}</h1>
        {listing.provider && (
          <p className="mb-4 text-sm text-muted">
            by <span className="font-mono text-ink">@{listing.provider.username}</span>
            {listing.provider.display_name ? ` · ${listing.provider.display_name}` : ""}
          </p>
        )}
        {listing.tagline && <p className="max-w-3xl text-lg leading-relaxed text-muted">{listing.tagline}</p>}
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-10">
          {listing.description && (
            <section aria-labelledby="about">
              <h2 id="about" className="mb-3 text-xl font-bold text-ink">About</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted">{listing.description}</p>
            </section>
          )}

          <section aria-labelledby="quickstart">
            <h2 id="quickstart" className="mb-3 text-xl font-bold text-ink">Quickstart</h2>
            <ol className="mb-5 space-y-2 text-sm text-muted">
              <li><span className="font-mono text-ink">1.</span> Subscribe to a plan (free tier available{plans.some((p) => p.price_cents === 0) ? "" : " soon"}).</li>
              <li><span className="font-mono text-ink">2.</span> Create a key in your <Link href="/dashboard" className="text-accent hover:underline">dashboard</Link>. One key works for every subscription.</li>
              <li><span className="font-mono text-ink">3.</span> Call the gateway. Paths after <code className="font-mono text-ink">/v1/{listing.slug}/</code> are forwarded to the provider.</li>
            </ol>
            <div className="overflow-hidden rounded-xl border border-line bg-ink">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                <span className="font-mono text-[11px] text-stone-400">shell</span>
                <CopyButton value={curl} className="text-stone-300 hover:bg-white/10 hover:text-white" />
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-stone-100 sm:text-sm"><code>{curl}</code></pre>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Responses include <code className="font-mono">X-RateLimit-Remaining</code>, <code className="font-mono">X-Quota-Remaining</code> and{" "}
              <code className="font-mono">X-Request-Id</code>. A <code className="font-mono">429</code> carries <code className="font-mono">Retry-After</code>.
            </p>
          </section>

          {listing.documentation_url && /^https?:\/\//i.test(listing.documentation_url) && (
            <a href={listing.documentation_url} target="_blank" rel="noopener noreferrer" className={ui.buttonSecondary}>
              <BookOpen className="h-4 w-4" aria-hidden /> Provider documentation
            </a>
          )}
        </div>

        <aside aria-labelledby="plans" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <h2 id="plans" className="text-xl font-bold text-ink">Plans</h2>
          {plans.length === 0 && <p className={`${ui.card} p-5 text-sm text-muted`}>This listing has no active plans yet.</p>}
          {plans.map((plan) => {
            const current = subscription?.plan?.id === plan.id;
            return (
              <div key={plan.id} className={`${ui.card} p-5 ${current ? "border-accent ring-1 ring-accent" : ""}`}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="font-bold text-ink">{plan.name}</h3>
                  <span className="font-mono text-sm font-semibold text-ink">{formatPrice(plan.price_cents)}</span>
                </div>
                <ul className="mb-5 space-y-1.5 text-sm text-muted">
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" aria-hidden />{formatNumber(plan.rate_limit_rpm)} requests / minute</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" aria-hidden />{formatNumber(plan.quota_monthly)} requests / month</li>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" aria-hidden />{feature}</li>
                  ))}
                </ul>
                {current ? (
                  <p className="rounded-lg bg-accent-soft px-3 py-2.5 text-center text-sm font-medium text-accent">Your current plan</p>
                ) : plan.price_cents > 0 ? (
                  <button type="button" disabled className={`${ui.buttonSecondary} w-full`}>
                    <Lock className="h-4 w-4" aria-hidden /> Paid checkout coming soon
                  </button>
                ) : listing.status !== "published" ? (
                  <p className="text-center text-xs text-muted">Publish the listing to accept subscribers.</p>
                ) : user ? (
                  <SubscribeButton planId={plan.id} label={subscription ? "Switch to this plan" : "Subscribe free"} />
                ) : (
                  <Link href={loginHref} className={`${ui.buttonPrimary} w-full`}>Sign in to subscribe</Link>
                )}
              </div>
            );
          })}
        </aside>
      </div>
    </main>
  );
}

function OwnerNotice({ listing }: { listing: OwnedListing }) {
  return (
    <div className="mb-8 rounded-xl border border-highlight/30 bg-highlight-soft p-4 text-sm text-highlight">
      <p className="font-semibold">You own this listing · status: {listing.status}</p>
      <p className="mt-1 text-highlight/90">
        Upstream (only visible to you): <code className="break-all font-mono">{listing.base_url ?? "not set"}</code>. Manage it from your{" "}
        <Link href="/dashboard" className="underline">dashboard</Link>.
      </p>
    </div>
  );
}
