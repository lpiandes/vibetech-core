import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Build Architect answers strictly from candidate evidence + current business state.
 */
export function buildIntelligenceCandidateArchitectBrief({
  candidate,
  stack = null,
  memory = null,
} = {}) {
  if (!candidate) {
    return deepFreeze({
      ok: false,
      reason: "candidate_not_found",
      answers: {
        whatNeedsAttention: "No intelligence candidate was provided.",
        whyItMatters: null,
        evidence: [],
        missingEvidence: ["intelligenceCandidateId"],
        owner: null,
        alreadyHandled: null,
        whatChanged: null,
        whatShouldWeDo: null,
        triedBefore: null,
      },
    });
  }

  const openWork = (stack?.workRuntime?.getWorkItems?.() ?? []).find((work) => (
    String(work.metadata?.businessIntelligence?.candidateId ?? "") === String(candidate.id)
    && !["completed", "cancelled", "failed", "rejected"].includes(String(work.status))
  ));

  const evidence = (candidate.evidence ?? []).map((entry) => ({
    objectType: entry.objectType,
    objectId: entry.objectId,
    explanation: entry.explanation,
    field: entry.field,
    observedValue: entry.observedValue,
  }));

  return deepFreeze({
    ok: true,
    intelligenceCandidateId: candidate.id,
    answers: {
      whatNeedsAttention: candidate.title,
      whyItMatters: candidate.explanation,
      evidence,
      missingEvidence: candidate.missingEvidence ?? [],
      confidenceReason: candidate.confidenceReason,
      owner: candidate.ownerRef,
      alreadyHandled: openWork
        ? `Open work ${openWork.id} already covers this candidate (${openWork.status}).`
        : candidate.status === "CONVERTED_TO_WORK"
          ? `Previously converted to work ${candidate.convertedWorkId}.`
          : "No open Work is linked to this candidate yet.",
      whatChanged: memory?.facts?.length
        ? memory.facts.join(" ")
        : "No prior memory events are recorded for this candidate.",
      whatShouldWeDo: (candidate.recommendedActions ?? []).map((action) => action.label).join("; ")
        || "Review evidence and decide.",
      triedBefore: memory?.facts?.find?.((fact) => /dismissed|recommended before|no response/i.test(fact))
        ?? (candidate.dismissalReason
          ? `Previously dismissed: ${candidate.dismissalReason}`
          : "No prior dismissal or failed attempt is recorded on this candidate."),
    },
    inventedFacts: false,
  });
}

export function formatArchitectCandidateReply(brief) {
  if (!brief?.ok) {
    return "I do not have an intelligence candidate loaded. Pass intelligenceCandidateId so I can answer from evidence.";
  }
  const a = brief.answers;
  const lines = [
    `What needs attention: ${a.whatNeedsAttention}`,
    `Why it matters: ${a.whyItMatters}`,
    `Confidence: ${a.confidenceReason}`,
    "Evidence:",
    ...(a.evidence ?? []).map((e) => `• ${e.objectType}:${e.objectId} — ${e.explanation}`),
  ];
  if (a.missingEvidence?.length) {
    lines.push("Missing evidence:");
    for (const m of a.missingEvidence) lines.push(`• ${m}`);
  }
  lines.push(`Owner: ${a.owner ? JSON.stringify(a.owner) : "unassigned"}`);
  lines.push(`Already handled: ${a.alreadyHandled}`);
  lines.push(`What changed: ${a.whatChanged}`);
  lines.push(`What we should do: ${a.whatShouldWeDo}`);
  lines.push(`Tried before: ${a.triedBefore}`);
  lines.push("I am not inventing business facts beyond the candidate evidence and current runtime state.");
  return lines.join("\n");
}
