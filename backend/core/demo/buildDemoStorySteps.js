import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function pushStep(steps, { id, title, detail, href = null, backed = true }) {
  if (!backed) return;
  steps.push(deepFreeze({ id, title, detail, href }));
}

/**
 * Read-only guided demo steps backed by canonical workspace facts.
 */
export function buildDemoStorySteps({
  identityViewModel,
  engagement,
  commandCenter,
  connectedSystemsSnapshot,
  audiences,
} = {}) {
  const steps = [];
  const businessName = identityViewModel?.businessName ?? "Your business";
  const partyName = String(engagement?.party?.displayName ?? "A contact");
  const subjectName = String(engagement?.subjects?.[0]?.displayName ?? "the relevant subject");
  const attentionCount = safeArray(commandCenter?.needsYourAttention).length;
  const handledCount = safeArray(commandCenter?.handledByVibeTech).length;
  const audienceCount = safeArray(engagement?.segmentMemberships).length;
  const nextAction = engagement?.nextActions?.[0]?.title ?? commandCenter?.whatHappensNext?.[0]?.title ?? null;
  const emailConn = safeArray(connectedSystemsSnapshot?.connections).find((c) => c.id === "business_email");
  const smsConn = safeArray(connectedSystemsSnapshot?.connections).find((c) => c.id === "sms_channel");

  pushStep(steps, {
    id: "welcome",
    title: `Welcome to ${businessName}`,
    detail: `${businessName} is activated with people, subjects, work, and automations ready to operate.`,
    backed: Boolean(identityViewModel),
  });

  pushStep(steps, {
    id: "inquiry",
    title: "A new inquiry arrived",
    detail: engagement?.openRequests?.[0]?.inboundAttribution
      ? `An inquiry came in from ${engagement.openRequests[0].inboundAttribution.sourceLabel ?? "your website"} and was linked to ${partyName}.`
      : engagement?.openRequests?.length
        ? `${partyName} has an active request in the system.`
        : null,
    href: engagement?.partyId ? `/engagement/${engagement.partyId}` : "/engagement",
    backed: Boolean(engagement?.openRequests?.length),
  });

  pushStep(steps, {
    id: "subject",
    title: "VIBETech linked the relevant subject",
    detail: `The inquiry is connected to ${subjectName}.`,
    href: engagement?.partyId ? `/engagement/${engagement.partyId}` : null,
    backed: Boolean(engagement?.subjects?.length),
  });

  pushStep(steps, {
    id: "acknowledgment",
    title: "VIBETech acknowledged the inquiry",
    detail:
      emailConn?.status === "CONNECTED"
        ? "Email acknowledgment was sent using the demo business email connection."
        : "Email acknowledgment is blocked until business email is connected.",
    backed: Boolean(engagement?.communications?.length),
  });

  pushStep(steps, {
    id: "qualification",
    title: "VIBETech captured qualification information",
    detail: engagement?.interactions?.[0]?.notes?.[0]?.text
      ? `Captured response: "${engagement.interactions[0].notes[0].text}"`
      : "Qualification details are preserved in interaction history.",
    href: engagement?.partyId ? `/engagement/${engagement.partyId}` : null,
    backed: Boolean(engagement?.interactions?.length),
  });

  pushStep(steps, {
    id: "work",
    title: "VIBETech created and assigned work",
    detail: engagement?.openWork?.[0]?.title
      ? `${engagement.openWork[0].title} is owned by your team.`
      : "Work was created from the configured automation.",
    href: "/work",
    backed: Boolean(engagement?.openWork?.length),
  });

  pushStep(steps, {
    id: "audiences",
    title: "Relevant audiences updated",
    detail:
      audienceCount > 0
        ? `${partyName} is included in ${audienceCount} relevant audience${audienceCount === 1 ? "" : "s"}.`
        : null,
    href: "/audiences",
    backed: audienceCount > 0,
  });

  pushStep(steps, {
    id: "history",
    title: "Complete relationship history is available",
    detail: `Timeline, communications, and outcomes for ${partyName} are visible in People & Relationships.`,
    href: engagement?.partyId ? `/engagement/${engagement.partyId}` : "/engagement",
    backed: Boolean(engagement?.timeline?.length),
  });

  pushStep(steps, {
    id: "attention",
    title: "Only exceptions need your judgment",
    detail:
      attentionCount > 0
        ? `${attentionCount} item(s) need your attention. Everything else is moving.`
        : "No exceptions need your judgment right now.",
    href: "/attention",
    backed: true,
  });

  pushStep(steps, {
    id: "next",
    title: "Here is what happens next",
    detail: nextAction ?? "Review work in progress and upcoming follow-ups.",
    href: "/work",
    backed: Boolean(nextAction || handledCount > 0),
  });

  pushStep(steps, {
    id: "connections",
    title: "Connection truthfulness",
    detail: `Email: ${emailConn?.status === "CONNECTED" ? "Demo connection active" : "Production setup required"}. SMS: ${smsConn?.status === "CONNECTED" ? "Demo connection active" : "Not connected — connect SMS to enable text follow-up."}`,
    href: "/connections",
    backed: Boolean(connectedSystemsSnapshot),
  });

  return deepFreeze(steps);
}
