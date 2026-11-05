import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeysPanel } from "@/components/dashboard/KeysPanel";
import { ListingsPanel } from "@/components/dashboard/ListingsPanel";
import { SubscriptionsPanel } from "@/components/dashboard/SubscriptionsPanel";
import { ui } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { getSessionUser } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  const repo = getRepo();
  const [keys, subscriptions, listings, usage] = await Promise.all([
    repo.listKeys(user.id),
    repo.listSubscriptions(user.id),
    repo.listOwned(user.id),
    repo.usageThisMonth(user.id),
  ]);
  const totalRequests = Object.values(usage).reduce((sum, u) => sum + u.requests, 0);

  const stats = [
    { label: "Active keys", value: keys.filter((k) => !k.revoked_at).length },
    { label: "Subscriptions", value: subscriptions.filter((s) => s.status !== "canceled").length },
    { label: "Requests this month", value: totalRequests },
    { label: "Your listings", value: listings.length },
  ];

  return (
    <main className={`${ui.container} py-12`}>
      <div className="mb-8">
        <p className={`${ui.eyebrow} mb-2`}>Developer workspace</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Dashboard</h1>
        {user.email && <p className="mt-1 text-sm text-muted">Signed in as {user.email}</p>}
      </div>

      <dl className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`${ui.card} p-5`}>
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd className="mt-1 font-heading text-2xl font-bold text-ink">{formatNumber(stat.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <KeysPanel keys={keys} />
        <SubscriptionsPanel subscriptions={subscriptions} usage={usage} />
        <div className="lg:col-span-2">
          <ListingsPanel listings={listings} />
        </div>
      </div>
    </main>
  );
}
