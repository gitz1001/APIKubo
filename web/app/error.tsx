"use client";

import { useEffect } from "react";
import { ui } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={`${ui.container} flex flex-col items-center py-24 text-center`}>
      <h1 className="mb-3 text-3xl font-bold text-ink">Something went wrong</h1>
      <p className="mb-8 max-w-md text-sm text-muted">
        We couldn&apos;t load this page. If it keeps happening, check that the database is reachable.
        {error.digest && <span className="mt-2 block font-mono text-xs">ref: {error.digest}</span>}
      </p>
      <button type="button" onClick={reset} className={ui.buttonPrimary}>Try again</button>
    </main>
  );
}
