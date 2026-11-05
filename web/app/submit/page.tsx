import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubmitListingForm } from "@/components/SubmitListingForm";
import { ui } from "@/components/ui";
import { gatewayUrl } from "@/lib/env";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Publish a listing" };

export default async function SubmitPage() {
  if (!(await getSessionUser())) redirect("/login?next=/submit");

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
      <SubmitListingForm gatewayUrl={gatewayUrl()} />
    </main>
  );
}
