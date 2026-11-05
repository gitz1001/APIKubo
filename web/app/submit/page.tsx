import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubmitListingForm } from "@/components/SubmitListingForm";
import { ui } from "@/components/ui";
import { gatewayUrl } from "@/lib/env";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Publish a listing" };

type Search = { [key: string]: string | string[] | undefined };
const one = (value: string | string[] | undefined) => ((Array.isArray(value) ? value[0] : value) ?? "").trim();

export default async function SubmitPage({ searchParams }: { searchParams: Search }) {
  if (!(await getSessionUser())) {
    const query = new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
    redirect(`/login?next=${encodeURIComponent(`/submit${query ? `?${query}` : ""}`)}`);
  }
  // Prefill from the Trending page ("Yours? List it"). Treated as untrusted: length-capped, https-only docs URL.
  const docs = one(searchParams.docs);
  const initial = {
    name: one(searchParams.name).slice(0, 80),
    tagline: one(searchParams.tagline).slice(0, 140),
    documentation_url: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(docs) ? docs : "",
  };

  return (
    <main className={`${ui.container} py-12`}>
      <div className="mb-10 max-w-2xl">
        <p className={`${ui.eyebrow} mb-2`}>Publish</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">List an API or AI Skill</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Point APIKUBO at your HTTPS endpoint. The gateway handles keys, rate limits, quotas and usage metering, then
          forwards authenticated calls to you. Your upstream URL is never shown to consumers.
        </p>
      </div>
      <SubmitListingForm gatewayUrl={gatewayUrl()} initial={initial} />
    </main>
  );
}
