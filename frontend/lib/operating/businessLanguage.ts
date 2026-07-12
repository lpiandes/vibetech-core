/**
 * Shared owner-facing business language helpers for operating surfaces.
 * Universal — no industry-specific hardcoding.
 */

const INTERNAL_PHRASES: Array<[RegExp, string]> = [
  [/canonical evidence/gi, "supporting records"],
  [/vibetech_app/gi, "VIBETech"],
  [/business_intelligence/gi, "VIBETech recommendation"],
  [/intelligence candidate/gi, "item needing your decision"],
  [/mission control/gi, "Home"],
  [/operating pulse/gi, "today"],
  [/dry[- ]?run/gi, "launch readiness"],
  [/runtime/gi, "system"],
  [/projection/gi, "view"],
  [/capability gap/gi, "something still needed"],
  [/episode/gi, "situation"],
];

export function scrubInternalWording(text: string | null | undefined): string {
  let out = String(text ?? "");
  for (const [pattern, replacement] of INTERNAL_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function humanizeEnumLabel(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^[A-Z0-9_]+$/.test(raw)) {
    return raw
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return scrubInternalWording(raw);
}

export function looksLikeInternalId(value: string | null | undefined): boolean {
  const raw = String(value ?? "");
  if (!raw) return false;
  if (/^(snap_|evt_|runtime_|agg_|spec_)/i.test(raw)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) return true;
  return false;
}

/** Suggested Ask VIBETech prompts — presentation only. */
export const ASK_VIBETECH_SUGGESTIONS = [
  "What should I focus on today?",
  "Build a referral program",
  "Help reduce response time",
  "Prepare a quarterly report",
  "Invite another team member",
  "Explain what needs my decision",
] as const;
