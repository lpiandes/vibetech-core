export type RelationshipFollowUpOutcome = {
  id: string;
  displayName?: string;
  applicableRelationshipTypes?: string[];
  requiresNote?: boolean;
  allowsNote?: boolean;
  requiresNextFollowUpAt?: boolean;
  allowsQualificationUpdates?: boolean;
};

export type RelationshipFollowUpWorkLike = {
  id?: string;
  status?: string;
  metadata?: {
    relationshipFollowUp?: {
      relationshipType?: string;
      candidateId?: string;
      ruleId?: string;
    } | null;
  };
};

export function isResolvableRelationshipFollowUpWork(item: RelationshipFollowUpWorkLike) {
  const status = String(item?.status ?? "");
  if (["completed", "cancelled", "failed", "rejected"].includes(status)) return false;
  const meta = item?.metadata?.relationshipFollowUp;
  return Boolean(item?.id && meta?.candidateId && meta?.relationshipType && meta?.ruleId);
}

export function allowedRelationshipFollowUpOutcomes({
  outcomes,
  relationshipType,
}: {
  outcomes?: RelationshipFollowUpOutcome[];
  relationshipType?: string;
}) {
  const rel = String(relationshipType ?? "");
  return (Array.isArray(outcomes) ? outcomes : []).filter((outcome) =>
    (outcome.applicableRelationshipTypes ?? []).map(String).includes(rel),
  );
}

export function outcomeRequiresNextFollowUpAt(outcome?: RelationshipFollowUpOutcome | null) {
  return Boolean(outcome?.requiresNextFollowUpAt);
}

export function outcomeAllowsQualificationUpdates(outcome?: RelationshipFollowUpOutcome | null) {
  return Boolean(outcome?.allowsQualificationUpdates);
}
