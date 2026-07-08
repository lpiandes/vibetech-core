export type RelationshipFollowUpCandidate = {
  candidateId: string;
  partyId: string;
  displayName: string;
  relationshipType: string;
  relationshipLabel: string;
  ruleId: string;
  priority: string;
  reasonCode: string;
  reasonLabel: string;
  evidence?: Record<string, unknown>;
  latestMeaningfulActivityAt: string | null;
  existingOpenWorkId: string | null;
  latestCompletedMatchingWorkId: string | null;
  recurrenceBlockedUntil: string | null;
  contactability?: {
    email?: { permitted?: boolean; reason?: string | null };
    sms?: { permitted?: boolean; reason?: string | null };
  };
  targetWork?: Record<string, unknown>;
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function sortRelationshipFollowUps(candidates: RelationshipFollowUpCandidate[] = []) {
  return [...candidates].sort((a, b) => {
    const pa = PRIORITY_ORDER[String(a.priority)] ?? 9;
    const pb = PRIORITY_ORDER[String(b.priority)] ?? 9;
    if (pa !== pb) return pa - pb;
    if (String(a.displayName) !== String(b.displayName)) return String(a.displayName).localeCompare(String(b.displayName));
    return String(a.candidateId).localeCompare(String(b.candidateId));
  });
}

export function contactabilityLabel(candidate: RelationshipFollowUpCandidate, channel: "email" | "sms") {
  const entry = candidate.contactability?.[channel];
  if (!entry) return "Allowed";
  return entry.permitted ? "Allowed" : "Blocked";
}

export function contactabilityTone(candidate: RelationshipFollowUpCandidate, channel: "email" | "sms") {
  return contactabilityLabel(candidate, channel) === "Blocked" ? "warning" : "success";
}

export function latestActivityLabel(candidate: RelationshipFollowUpCandidate) {
  if (!candidate.latestMeaningfulActivityAt) return "No meaningful activity found";
  return `Latest meaningful activity ${new Date(candidate.latestMeaningfulActivityAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}
