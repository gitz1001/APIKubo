/** Shared class recipes so every screen uses the same buttons, inputs and cards. */
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const ui = {
  buttonPrimary: `${buttonBase} bg-accent text-white hover:bg-accent-hover`,
  buttonSecondary: `${buttonBase} border border-line bg-surface text-ink hover:border-accent hover:text-accent`,
  buttonGhost: `${buttonBase} text-muted hover:bg-background hover:text-ink`,
  buttonDanger: `${buttonBase} border border-line bg-surface text-danger hover:border-danger hover:bg-red-50`,
  input:
    "w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/15",
  label: "mb-1.5 block text-xs font-medium text-ink",
  hint: "mt-1.5 text-[11px] text-muted",
  error: "mt-1.5 text-xs text-danger",
  card: "rounded-xl border border-line bg-surface",
  eyebrow: "text-xs font-semibold uppercase tracking-widest text-accent",
  container: "mx-auto w-full max-w-7xl px-4 sm:px-8",
  code: "rounded-lg border border-line bg-ink px-4 py-3 font-mono text-xs leading-relaxed text-stone-100",
} as const;
