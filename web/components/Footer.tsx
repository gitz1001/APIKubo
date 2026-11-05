import Link from "next/link";
import { ui } from "./ui";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface py-10">
      <div className={`${ui.container} flex flex-col gap-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-3">
          <span className="font-heading text-sm font-bold text-ink">APIKUBO</span>
          <span aria-hidden>·</span>
          <span>APIs &amp; AI Skills. One home.</span>
        </div>
        <nav className="flex gap-5" aria-label="Footer">
          <Link href="/explore" className="hover:text-ink">Explore</Link>
          <Link href="/trending" className="hover:text-ink">Trending</Link>
          <Link href="/submit" className="hover:text-ink">Publish</Link>
          <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
        </nav>
      </div>
    </footer>
  );
}
