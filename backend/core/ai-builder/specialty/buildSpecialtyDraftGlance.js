/**
 * Generic 5-second "what happened" card for specialty automation drafts.
 * No vertical hardcoding — only uses teammate, trigger, payload, and draft facts.
 */

function clip(text, max) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1))}…`;
}

function safeName(payload = {}) {
  return String(
    payload?.name
    ?? payload?.contact?.name
    ?? payload?.email
    ?? payload?.phone
    ?? "",
  ).trim();
}

/**
 * @returns {{
 *   title: string,
 *   summary: string,
 *   whyNeedsYou: string,
 *   workHref: string | null,
 * }}
 */
export function buildSpecialtyDraftGlance({
  employee = {},
  triggerLabel = null,
  triggerEventType = null,
  eventPayload = null,
  brief = "",
  artifact = null,
  approvalIds = [],
  businessId = null,
  workId = null,
  needsYou = true,
} = {}) {
  const teammate = String(
    employee?.displayName
    ?? employee?.label
    ?? employee?.name
    ?? "AI teammate",
  ).trim() || "AI teammate";
  const trigger = String(triggerLabel ?? triggerEventType ?? "Automation ran").trim() || "Automation ran";
  const who = safeName(eventPayload ?? {});
  const deliverable = String(artifact?.title ?? "").trim();
  const briefLine = clip(brief, 72);

  const title = who
    ? `${teammate}: ${clip(who, 40)}`
    : `${teammate} prepared a draft`;

  const summaryParts = [trigger];
  if (who) summaryParts.push(who);
  else if (deliverable) summaryParts.push(clip(deliverable, 48));
  else if (briefLine) summaryParts.push(briefLine);

  let whyNeedsYou = "Open the draft and decide what happens next.";
  if (needsYou === false) {
    whyNeedsYou = "Ran automatically — no owner action required.";
  } else if (Array.isArray(approvalIds) && approvalIds.length) {
    whyNeedsYou = "Approve the email/text before anything sends.";
  } else if (Array.isArray(artifact?.gaps) && artifact.gaps.length) {
    whyNeedsYou = "Review the draft — something still needs your input.";
  }

  return {
    title: clip(title, 72),
    summary: clip(summaryParts.filter(Boolean).join(" · "), 120),
    whyNeedsYou,
    needsYou: needsYou !== false,
    workHref: businessId && workId
      ? `/b/${encodeURIComponent(String(businessId))}/work?workId=${encodeURIComponent(String(workId))}`
      : null,
  };
}
