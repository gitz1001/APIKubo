import type { Plan } from "./types";
import { CATEGORIES, LISTING_TYPES } from "./validation";

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}/mo`;
}

export function startingPrice(plans: Plan[]): string {
  const active = plans.filter((p) => p.is_active);
  if (active.length === 0) return "No plans yet";
  const cheapest = Math.min(...active.map((p) => p.price_cents));
  return cheapest === 0 ? "Free tier" : `From ${formatPrice(cheapest)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: value >= 100_000 ? "compact" : "standard" }).format(value);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function typeLabel(id: string): string {
  return LISTING_TYPES.find((t) => t.id === id)?.label ?? id;
}
