import { checkCommunicationPermitted } from "../communications/preferences/CommunicationPreferenceEnforcer.js";
import { ENTITY_TYPES } from "../references/EntityRef.js";
import { buildRelationshipFollowUpEvidence, workMatchesRelationshipFollowUp } from "../relationship-followup/RelationshipFollowUpEvidence.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function categoryTokens(categoryId) {
  return String(categoryId ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && token !== "pm" && token.length > 2);
}

function inferredCategoryMatches(doc, allowedCategoryIds) {
  const haystack = `${doc?.title ?? ""} ${doc?.originalFilename ?? ""} ${doc?.contentText ?? ""}`.toLowerCase();
  return safeArray(allowedCategoryIds).some((categoryId) => categoryTokens(categoryId).some((token) => haystack.includes(token)));
}

function knowledgeExcerpt(doc, maxChars = 220) {
  const text = normalizeText(doc?.contentText);
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).replace(/\s+\S*$/, "")}...`;
}

function relationshipFollowUpMetadata(work) {
  return isPlainObject(work?.metadata?.relationshipFollowUp) ? work.metadata.relationshipFollowUp : null;
}

function findPartySubject({ stack, partyId }) {
  for (const rel of safeArray(stack?.businessGraphRuntime?.getRelationships?.())) {
    if (String(rel.status) !== "active") continue;
    if (String(rel.relationshipType) !== "INTERESTED_IN") continue;
    if (String(rel.fromEntity?.entityType) !== ENTITY_TYPES.PARTY) continue;
    if (String(rel.fromEntity?.entityId) !== String(partyId)) continue;
    if (String(rel.toEntity?.entityType) !== ENTITY_TYPES.SUBJECT) continue;
    const subject = stack.businessSubjectRuntime?.getSubject?.(String(rel.toEntity.entityId));
    if (subject) return subject;
  }
  return null;
}

function findActiveRelationship({ stack, relationshipId, partyId, relationshipType }) {
  if (relationshipId) {
    const relationship = stack.businessGraphRuntime?.getRelationship?.(String(relationshipId));
    if (relationship && String(relationship.status) === "active") return relationship;
  }
  return safeArray(stack.businessGraphRuntime?.getRelationships?.()).find((rel) => {
    if (String(rel.status) !== "active") return false;
    if (String(rel.relationshipType) !== String(relationshipType)) return false;
    const fromMatches = String(rel.fromEntity?.entityType) === ENTITY_TYPES.PARTY && String(rel.fromEntity?.entityId) === String(partyId);
    const toMatches = String(rel.toEntity?.entityType) === ENTITY_TYPES.PARTY && String(rel.toEntity?.entityId) === String(partyId);
    return fromMatches || toMatches;
  }) ?? null;
}

function safeKnowledgeDocuments({ documents = [], businessId, allowedCategoryIds = [] } = {}) {
  const allowed = new Set(safeArray(allowedCategoryIds).map(String));
  return safeArray(documents)
    .filter((doc) => String(doc?.businessId ?? businessId) === String(businessId))
    .filter((doc) => String(doc?.status ?? "") === "ready")
    .filter((doc) => !doc?.deletedAt)
    .filter((doc) => {
      const categories = safeArray(doc?.categoryIds).map(String);
      if (!allowed.size) return true;
      if (!categories.length) return inferredCategoryMatches(doc, [...allowed]);
      return categories.some((id) => allowed.has(id));
    })
    .filter((doc) => knowledgeExcerpt(doc))
    .map((doc) => ({
      id: String(doc.id),
      title: String(doc.title ?? doc.originalFilename ?? "Knowledge document"),
      sourceType: String(doc.sourceType ?? ""),
      categoryIds: safeArray(doc.categoryIds).map(String),
      excerpt: knowledgeExcerpt(doc),
    }))
    .sort((a, b) => String(a.title).localeCompare(String(b.title)) || String(a.id).localeCompare(String(b.id)))
    .slice(0, 3);
}

export class RelationshipFollowUpDraftContextAssembler {
  assemble({ stack, installationResult, businessId, workId, knowledgeDocuments = [] } = {}) {
    const work = stack?.workRuntime?.getWorkItem?.(String(workId));
    if (!work) return { ok: false, reason: "work_not_found", errors: ["Work not found."] };

    const meta = relationshipFollowUpMetadata(work);
    if (!meta) return { ok: false, reason: "ineligible_work", errors: ["Work is not relationship follow-up work."] };

    const party = stack.businessGraphRuntime?.getParty?.(String(meta.partyId ?? work.requestedBy ?? ""));
    const relationship = findActiveRelationship({
      stack,
      relationshipId: meta.relationshipId,
      partyId: party?.id,
      relationshipType: meta.relationshipType,
    });
    if (!party || !relationship || String(relationship.status) !== "active") {
      return { ok: false, reason: "missing_relationship_context", errors: ["Active relationship context not found."] };
    }

    const rule = safeArray(installationResult?.relationshipFollowUpRules).find((entry) => String(entry.id) === String(meta.ruleId));
    const targetWorkType = rule?.targetWork?.workType ?? work.workType;
    if (!workMatchesRelationshipFollowUp({
      work,
      candidateId: meta.candidateId,
      partyId: party.id,
      relationshipType: relationship.relationshipType,
      ruleId: meta.ruleId,
      targetWorkType,
    })) {
      return { ok: false, reason: "ineligible_work", errors: ["Work does not match a relationship follow-up candidate."] };
    }

    const evidence = buildRelationshipFollowUpEvidence({
      businessGraphRuntime: stack.businessGraphRuntime,
      requestRuntime: stack.requestRuntime,
      workRuntime: stack.workRuntime,
      interactionRuntime: stack.interactionRuntime,
      communicationRuntime: stack.communicationRuntime,
      businessSubjectRuntime: stack.businessSubjectRuntime,
      communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
      relationshipTypes: installationResult?.relationshipTypes ?? [],
      party,
      relationship,
      rule,
      nowISO: new Date().toISOString(),
    });
    const subject = evidence.propertyInterest?.subjectId
      ? stack.businessSubjectRuntime?.getSubject?.(String(evidence.propertyInterest.subjectId))
      : findPartySubject({ stack, partyId: party.id });
    const email = checkCommunicationPermitted({
      preferenceRuntime: stack.communicationPreferenceRuntime,
      partyId: party.id,
      channel: "email",
    });
    const sms = checkCommunicationPermitted({
      preferenceRuntime: stack.communicationPreferenceRuntime,
      partyId: party.id,
      channel: "sms",
    });

    const assistanceRule = safeArray(installationResult?.relationshipFollowUpDraftAssistance).find((entry) =>
      safeArray(entry.relationshipTypes).map(String).includes(String(relationship.relationshipType)),
    );
    const knowledge = safeKnowledgeDocuments({
      documents: knowledgeDocuments,
      businessId,
      allowedCategoryIds: assistanceRule?.knowledgeCategoryIds ?? [],
    });

    return {
      ok: true,
      work,
      party,
      relationship,
      subject,
      rule,
      assistanceRule,
      evidence,
      qualification: evidence.qualification ?? {},
      knowledge,
      channelGuidance: {
        recommendedChannel: assistanceRule?.channel ?? "email",
        email: { permitted: Boolean(email.permitted), reason: email.reason ?? null },
        sms: { permitted: Boolean(sms.permitted), reason: sms.reason ?? null },
      },
    };
  }
}
