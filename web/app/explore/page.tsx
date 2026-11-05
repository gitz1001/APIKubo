import type { Metadata } from "next";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { ui } from "@/components/ui";
import { getRepo } from "@/lib/server/repo";
import type { ListingType } from "@/lib/types";
import { CATEGORIES } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore", description: "Browse APIs and AI Skills on APIKUBO." };

type Search = { [key: string]: string | string[] | undefined };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function ExplorePage({ searchParams }: { searchParams: Search }) {
  const listings = await getRepo().listPublished();
  const type = one(searchParams.type);
  const category = one(searchParams.category);

  return (
    <main className={`${ui.container} py-12`}>
      <div className="mb-8">
        <p className={`${ui.eyebrow} mb-2`}>Catalog</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Explore APIs &amp; AI Skills</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every listing is reachable through the APIKUBO gateway with a single key. Subscribe to a plan, then call it.
        </p>
      </div>
      <CatalogBrowser
        listings={listings}
        initial={{
          q: one(searchParams.q).slice(0, 100),
          type: type === "api" || type === "ai_skill" ? (type as ListingType) : "all",
          category: CATEGORIES.some((c) => c.id === category) ? category : "all",
          sort: one(searchParams.sort) === "newest" ? "newest" : "popular",
        }}
      />
    </main>
  );
}
