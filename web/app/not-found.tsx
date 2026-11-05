import Link from "next/link";
import { ui } from "@/components/ui";

export default function NotFound() {
  return (
    <main className={`${ui.container} flex flex-col items-center py-24 text-center`}>
      <p className="mb-2 font-mono text-sm text-muted">404</p>
      <h1 className="mb-3 text-3xl font-bold text-ink">This page isn&apos;t in the catalog</h1>
      <p className="mb-8 max-w-md text-sm text-muted">The listing may be unpublished, renamed, or never existed.</p>
      <Link href="/explore" className={ui.buttonPrimary}>Explore listings</Link>
    </main>
  );
}
