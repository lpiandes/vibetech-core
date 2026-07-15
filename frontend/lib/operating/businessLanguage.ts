/**
 * Home / owner-facing language — presentation only.
 */

const INTERNAL_PHRASES: Array<[RegExp, string]> = [
  [/canonical evidence/gi, "supporting records"],
  [/vibetech_app/gi, "VIBETech"],
  [/business_intelligence/gi, "recommendation"],
  [/intelligence candidate/gi, "decision"],
  [/mission control/gi, "Home"],
  [/operating pulse/gi, "today"],
  [/dry[- ]?run/gi, "launch readiness"],
  [/runtime/gi, "system"],
  [/projection/gi, "view"],
  [/capability gap/gi, "something still needed"],
  [/episode/gi, "situation"],
  [/workflow/gi, "task"],
  [/review[_ ]?required/gi, "needs your approval"],
  [/qualification captured/gi, "qualified"],
  [/digital workforce/gi, "AI team"],
  [/digital employee/gi, "AI teammate"],
  [/business memory/gi, "recent wins"],
  [/needs attention/gi, "waiting for you"],
  [/business_email/gi, "business email"],
  [/required connection missing:\s*/gi, "Needs connection: "],
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
  if (/^(snap_|evt_|runtime_|agg_|spec_|work_|intel_)/i.test(raw)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) return true;
  return false;
}

/** Home Ask suggestions — industry-agnostic; derived from live Home state. */
export const ASK_VIBETECH_SUGGESTIONS = [
  "What needs me today?",
  "What is VIBETech handling?",
  "What changed today?",
] as const;

export function buildAskSuggestions({
  waitingCount = 0,
  workingCount = 0,
  winCount = 0,
  approvalCount = 0,
}: {
  waitingCount?: number;
  workingCount?: number;
  winCount?: number;
  approvalCount?: number;
} = {}): string[] {
  if (waitingCount > 0) {
    return [
      "Help me clear what’s waiting",
      waitingCount === 1 ? "Walk me through this item" : "What should I handle first?",
      "What can wait until later?",
    ];
  }
  if (approvalCount > 0) {
    return [
      "Help me review what teammates need approved",
      "What happens if I wait on these approvals?",
      "What should I handle first?",
    ];
  }
  if (workingCount > 0) {
    return [
      "What is VIBETech handling?",
      "Do I need to step in on anything?",
      "What changed today?",
    ];
  }
  if (winCount > 0) {
    return [
      "Summarize today’s wins",
      "What should I focus on next?",
      "What needs me today?",
    ];
  }
  return [...ASK_VIBETECH_SUGGESTIONS];
}

const JUNK_BUSINESS_NAMES = new Set([
  "ok",
  "okay",
  "yes",
  "y",
  "no",
  "n",
  "idk",
  "n/a",
  "na",
  "none",
  "test",
  "asdf",
]);

export function isUsableBusinessName(value: string | null | undefined): boolean {
  const text = String(value ?? "").trim();
  if (text.length < 2) return false;
  if (JUNK_BUSINESS_NAMES.has(text.toLowerCase())) return false;
  if (/^(ok|okay|yes|no)([!.]?)$/i.test(text)) return false;
  return true;
}

export function resolveBusinessDisplayName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    if (isUsableBusinessName(candidate)) return String(candidate).trim();
  }
  return "Your business";
}

/**
 * Turn raw supervision titles into owner-readable decision labels.
 * e.g. "Work Monthly market update: needs your approval" → "Monthly market update"
 */
export function humanizeHomeDecisionTitle(title: string | null | undefined): string {
  let out = scrubInternalWording(title);
  out = out.replace(/^(work|people|knowledge|campaign|module)\s+/i, "");
  out = out.replace(/\s*[:—-]\s*(needs your approval|needs approval|review required|awaiting approval)\s*$/i, "");
  out = out.replace(/\s*\((needs your approval|installed|review required)\)\s*$/i, "");
  out = out.trim();
  if (!out) return "Item waiting for you";
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function homeDecisionKind(title: string | null | undefined, why?: string | null): string {
  const blob = `${title ?? ""} ${why ?? ""}`.toLowerCase();
  if (/approv|review required|needs your/.test(blob)) return "Approval";
  if (/connect|setup|integrat/.test(blob)) return "Setup";
  if (/decision|judgment|choose/.test(blob)) return "Decision";
  return "Needs you";
}

