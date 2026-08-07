import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function pushStep(steps, { id, title, detail, href = null, backed = true }) {
  if (!backed) return;
  if (!detail) return;
  steps.push(deepFreeze({ id, title, detail, href }));
}

/**
 * Read-only guided demo steps for Managed Revenue Follow-Through.
 * Only pushes steps backed by real workspace facts — no CRM/engagement theater.
 */
export function buildDemoStorySteps({
  identityViewModel,
  engagement,
  commandCenter,
  connectedSystemsSnapshot,
  audiences,
  outcomesLedger = null,
  rftLaunch = null,
} = {}) {
  const steps = [];
  const businessName = identityViewModel?.businessName ?? "Your business";
  const attentionCount = safeArray(commandCenter?.needsYourAttention).length;
  const handledCount = safeArray(commandCenter?.handledByVibeTech).length;
  const emailConn = safeArray(connectedSystemsSnapshot?.connections).find((c) => c.id === "business_email");
  const calendarConn = safeArray(connectedSystemsSnapshot?.connections).find((c) =>
    c.id === "calendar" || c.id === "google_calendar"
  );
  const proofBacked = Number(outcomesLedger?.summary?.proofBackedCompleted ?? 0);

  pushStep(steps, {
    id: "welcome",
    title: `Welcome to ${businessName}`,
    detail: `${businessName} is on Managed Revenue Follow-Through — Today, Decisions, Outcomes, and Company Rules.`,
    href: "/home",
    backed: Boolean(identityViewModel),
  });

  const emailConnected = String(emailConn?.status ?? "").toUpperCase() === "CONNECTED"
    || String(emailConn?.status ?? "").toUpperCase() === "PROVEN"
    || String(emailConn?.status ?? "").toUpperCase() === "VERIFIED";
  const calendarConnected = String(calendarConn?.status ?? "").toUpperCase() === "CONNECTED"
    || String(calendarConn?.status ?? "").toUpperCase() === "PROVEN"
    || String(calendarConn?.status ?? "").toUpperCase() === "VERIFIED";

  pushStep(steps, {
    id: "connections",
    title: "Connected channels",
    detail: emailConnected || calendarConnected
      ? [
        emailConnected ? "Business email connected" : null,
        calendarConnected ? "Calendar connected" : null,
      ].filter(Boolean).join(" · ") + ". Connected is not Proven — prove each channel with a real provider id."
      : null,
    href: "/integrations",
    backed: emailConnected || calendarConnected,
  });

  pushStep(steps, {
    id: "today",
    title: "Today is the operating brief",
    detail: attentionCount > 0
      ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need you on Today.`
      : (rftLaunch?.goLiveAt
        ? "Live — waiting for the next eligible opportunity."
        : null),
    href: "/home",
    backed: attentionCount > 0 || Boolean(rftLaunch?.goLiveAt),
  });

  pushStep(steps, {
    id: "decisions",
    title: "Decisions are managerial approvals",
    detail: attentionCount > 0
      ? "Review what happened, evidence, and the proposed next step — approve, edit, or reject."
      : null,
    href: "/intelligence",
    backed: attentionCount > 0,
  });

  pushStep(steps, {
    id: "outcomes",
    title: "Outcomes with proof",
    detail: proofBacked > 0
      ? `${proofBacked} proof-backed completion${proofBacked === 1 ? "" : "s"} with provider evidence.`
      : (handledCount > 0
        ? `${handledCount} handled item${handledCount === 1 ? "" : "s"} — open Outcomes for proof status.`
        : null),
    href: "/outcomes",
    backed: proofBacked > 0 || handledCount > 0,
  });

  // Intentionally ignore audiences / people / engagement theater when unbacked.
  void audiences;
  void engagement;

  return deepFreeze(steps);
}
