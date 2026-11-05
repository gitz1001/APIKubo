"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Method = "POST" | "PATCH" | "DELETE";

/** fetch + error extraction + router.refresh() so server-rendered data updates after a change. */
export function useMutation() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  const run = useCallback(
    async <T = unknown>(id: string, url: string, method: Method, body?: unknown): Promise<T | null> => {
      setPending(id);
      setError("");
      try {
        const response = await fetch(url, {
          method,
          headers: body === undefined ? undefined : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
        if (!response.ok) {
          setError(payload?.error?.message ?? "Request failed");
          return null;
        }
        router.refresh();
        return payload;
      } catch {
        setError("Network error. Please try again.");
        return null;
      } finally {
        setPending(null);
      }
    },
    [router],
  );

  return { run, pending, error, setError };
}
