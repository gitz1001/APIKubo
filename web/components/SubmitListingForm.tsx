"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import type { ListingType } from "@/lib/types";
import { CATEGORIES, LIMITS, LISTING_TYPES, slugify, validateListingInput } from "@/lib/validation";
import { ui } from "./ui";

interface FormState {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  type: ListingType;
  category: string;
  base_url: string;
  documentation_url: string;
  rate_limit_rpm: string;
  quota_monthly: string;
}

const INITIAL: FormState = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  type: "api",
  category: "general",
  base_url: "",
  documentation_url: "",
  rate_limit_rpm: "60",
  quota_monthly: "1000",
};

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={ui.label}>{label}</label>
      {children}
      {error ? <p id={`${id}-error`} className={ui.error}>{error}</p> : hint ? <p className={ui.hint}>{hint}</p> : null}
    </div>
  );
}

type Prefill = Partial<Pick<FormState, "name" | "tagline" | "documentation_url">>;

export function SubmitListingForm({ gatewayUrl, initial = {} }: { gatewayUrl: string; initial?: Prefill }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => {
    const prefilled = Object.fromEntries(Object.entries(initial).filter(([, v]) => Boolean(v))) as Prefill;
    return { ...INITIAL, ...prefilled, slug: prefilled.name ? slugify(prefilled.name) : "" };
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState<"draft" | "published" | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
    setErrors((e) => {
      const { [key]: _removed, ...rest } = e;
      void _removed;
      return rest;
    });
  }

  async function submit(status: "draft" | "published") {
    const payload = {
      ...form,
      status,
      free_plan: { rate_limit_rpm: form.rate_limit_rpm, quota_monthly: form.quota_monthly },
    };
    const local = validateListingInput(payload);
    if (!local.ok) {
      setErrors(local.errors);
      return;
    }
    setSubmitting(status);
    setFormError("");
    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | { listing?: { slug: string }; error?: { message?: string; code?: string; fields?: Record<string, string> } }
        | null;
      if (!response.ok || !body?.listing) {
        if (body?.error?.fields) setErrors(body.error.fields);
        if (body?.error?.code === "conflict") setErrors((e) => ({ ...e, slug: body.error?.message ?? "Slug taken" }));
        else setFormError(body?.error?.message ?? "Could not create the listing");
        return;
      }
      router.push(`/listings/${body.listing.slug}`);
      router.refresh();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  const inputProps = (key: keyof FormState) => ({
    id: key,
    value: form[key],
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
    className: ui.input,
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit("published");
      }}
      className="grid gap-8 lg:grid-cols-[1fr_320px]"
    >
      <div className="space-y-8">
        <fieldset className={`${ui.card} space-y-5 p-6`}>
          <legend className="sr-only">Basics</legend>
          <h2 className="text-lg font-bold text-ink">Basics</h2>
          <div role="radiogroup" aria-label="Listing type" className="grid grid-cols-2 gap-3">
            {LISTING_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={form.type === t.id}
                onClick={() => set("type", t.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${form.type === t.id ? "border-accent bg-accent-soft" : "border-line hover:border-muted"}`}
              >
                <span className="block font-heading font-bold text-ink">{t.label}</span>
                <span className="text-xs text-muted">{t.id === "api" ? "A REST/HTTP API you operate" : "An agent capability exposed over HTTP"}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="name" label="Name" error={errors.name}>
              <input {...inputProps("name")} maxLength={LIMITS.nameMax} placeholder="Weather Pro" onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field id="slug" label="Slug" error={errors.slug} hint="Permanent: it becomes part of every consumer's URL.">
              <input
                {...inputProps("slug")}
                className={`${ui.input} font-mono`}
                maxLength={50}
                placeholder="weather-pro"
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
              />
            </Field>
          </div>
          <Field id="tagline" label="Tagline" error={errors.tagline} hint={`${form.tagline.length}/${LIMITS.taglineMax}`}>
            <input {...inputProps("tagline")} maxLength={LIMITS.taglineMax} placeholder="One sentence on what it does" onChange={(e) => set("tagline", e.target.value)} />
          </Field>
          <Field id="description" label="Description" error={errors.description}>
            <textarea
              {...inputProps("description")}
              rows={6}
              maxLength={LIMITS.descriptionMax}
              placeholder="Inputs, outputs, typical use cases, limits…"
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <Field id="category" label="Category" error={errors.category}>
            <select {...inputProps("category")} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
        </fieldset>

        <fieldset className={`${ui.card} space-y-5 p-6`}>
          <legend className="sr-only">Endpoint</legend>
          <h2 className="text-lg font-bold text-ink">Endpoint</h2>
          <Field id="base_url" label="Upstream base URL" error={errors.base_url} hint="Public HTTPS only. Private networks are blocked by the gateway.">
            <input {...inputProps("base_url")} className={`${ui.input} font-mono`} type="url" placeholder="https://api.example.com/v1" onChange={(e) => set("base_url", e.target.value)} />
          </Field>
          <Field id="documentation_url" label="Documentation URL (optional)" error={errors.documentation_url}>
            <input {...inputProps("documentation_url")} type="url" placeholder="https://docs.example.com" onChange={(e) => set("documentation_url", e.target.value)} />
          </Field>
        </fieldset>

        <fieldset className={`${ui.card} space-y-5 p-6`}>
          <legend className="sr-only">Free tier</legend>
          <div>
            <h2 className="text-lg font-bold text-ink">Free tier</h2>
            <p className="mt-1 text-xs text-muted">Every listing starts with a free plan so developers can try it. Paid plans arrive with billing.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="rate_limit_rpm" label="Requests per minute" error={errors.rate_limit_rpm}>
              <input {...inputProps("rate_limit_rpm")} type="number" inputMode="numeric" min={1} max={LIMITS.rpmMax} onChange={(e) => set("rate_limit_rpm", e.target.value)} />
            </Field>
            <Field id="quota_monthly" label="Requests per month" error={errors.quota_monthly}>
              <input {...inputProps("quota_monthly")} type="number" inputMode="numeric" min={1} max={LIMITS.quotaMax} onChange={(e) => set("quota_monthly", e.target.value)} />
            </Field>
          </div>
        </fieldset>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className={`${ui.card} p-5`}>
          <p className="mb-2 text-xs font-medium text-muted">Consumers will call</p>
          <code className="block break-all rounded-md bg-background px-3 py-2 font-mono text-xs text-ink">
            {gatewayUrl}/v1/{form.slug || "your-slug"}/…
          </code>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            The gateway strips the consumer&apos;s key and forwards to your base URL with an <code className="font-mono">X-Kubo-Request-Id</code> header.
          </p>
        </div>
        {formError && <p className="rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger" role="alert">{formError}</p>}
        {Object.keys(errors).length > 0 && !formError && (
          <p className="text-xs text-danger" role="alert">Fix the highlighted fields to continue.</p>
        )}
        <button type="submit" disabled={submitting !== null} className={`${ui.buttonPrimary} w-full py-3`}>
          {submitting === "published" ? "Publishing…" : "Publish listing"}
        </button>
        <button type="button" disabled={submitting !== null} onClick={() => void submit("draft")} className={`${ui.buttonSecondary} w-full`}>
          {submitting === "draft" ? "Saving…" : "Save as draft"}
        </button>
      </aside>
    </form>
  );
}
