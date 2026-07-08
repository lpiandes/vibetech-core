import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { EngagementViewAdapter } from "./EngagementViewAdapter.js";
import { formatBusinessDate } from "../presentation/formatBusinessDate.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isOpenWorkStatus(status) {
  return !["completed", "cancelled", "closed"].includes(String(status ?? ""));
}

function isOpenRequestStatus(status) {
  return !["closed", "cancelled", "rejected"].includes(String(status ?? ""));
}

function latestTimestamp(...values) {
  const times = values.filter(Boolean).map((v) => new Date(String(v)).getTime()).filter((n) => !Number.isNaN(n));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function relationshipDisplayLabel(presentation, relationshipType) {
  const key = String(relationshipType ?? "");
  if (key === "REQUESTED_BY") return null;
  return presentation?.relationshipLabels?.[key] ?? key.replace(/_/g, " ").toLowerCase();
}

function partyTypeDisplayLabel(presentation, partyType) {
  const key = String(partyType ?? "").toUpperCase();
  return presentation?.partyTypeLabels?.[key] ?? null;
}

function resolvePartyContact(party) {
  const methods = safeArray(party?.contactMethods).map((method) => String(method));
  const email = methods.find((method) => method.includes("@")) ?? null;
  const phone =
    methods.find((method) => !method.includes("@") && /\d/.test(method)) ?? null;
  return { email, phone };
}

function collectPartySubjectIds({ partyId, relationships, partyRequests, businessSubjectRuntime }) {
  const subjectIds = new Set();
  for (const rel of safeArray(relationships)) {
    const involvesParty =
      (String(rel?.fromEntity?.entityType) === "Party" && String(rel?.fromEntity?.entityId) === partyId) ||
      (String(rel?.toEntity?.entityType) === "Party" && String(rel?.toEntity?.entityId) === partyId);
    const other =
      String(rel?.fromEntity?.entityType) === "Subject"
        ? String(rel?.fromEntity?.entityId)
        : String(rel?.toEntity?.entityType) === "Subject"
          ? String(rel?.toEntity?.entityId)
          : null;
    if (involvesParty && other) subjectIds.add(other);
  }
  for (const req of safeArray(partyRequests)) {
    for (const ref of safeArray(req.subjectRefs)) {
      if (ref?.entityId) subjectIds.add(String(ref.entityId));
    }
  }
  const names = [...subjectIds]
    .map((id) => businessSubjectRuntime?.getSubject?.(id)?.displayName)
    .filter(Boolean);
  const primarySubjectId = [...subjectIds][0] ?? null;
  return { subjectCount: subjectIds.size, primarySubjectId, primarySubjectName: names[0] ?? null, subjectNames: names };
}

function buildLatestQualificationProfile(partyRequests) {
  const sorted = [...safeArray(partyRequests)].sort((a, b) =>
    String(b?.receivedAt ?? b?.createdAt ?? "").localeCompare(String(a?.receivedAt ?? a?.createdAt ?? "")),
  );
  for (const request of sorted) {
    const qualification = request?.metadata?.qualification;
    if (qualification && typeof qualification === "object" && Object.keys(qualification).length > 0) {
      return qualification;
    }
  }
  return {};
}

function collectPartyRelationships(partyId, relationships) {
  return relationships
    .filter(
      (rel) =>
        (String(rel?.toEntity?.entityType) === "Party" && String(rel?.toEntity?.entityId) === partyId) ||
        (String(rel?.fromEntity?.entityType) === "Party" && String(rel?.fromEntity?.entityId) === partyId),
    )
    .map((rel) =>
      deepFreeze({
        type: String(rel.relationshipType),
        status: String(rel.status ?? "active"),
        effectiveTo: rel.effectiveTo ?? null,
      }),
    )
    .filter((rel) => rel.type !== "REQUESTED_BY");
}

/**
 * Deterministic People & Relationships index for engagement OS.
 */
export function buildEngagementPartyIndex({
  businessGraphRuntime,
  requestRuntime,
  workRuntime,
  interactionRuntime,
  communicationRuntime,
  businessSubjectRuntime,
  communicationPreferenceRuntime,
  segmentDefinitionRuntime,
  automationRuntime,
  approvalRuntime,
  presentation,
  businessId,
  nowISO,
} = {}) {
  const effectiveGraph = businessGraphRuntime;
  const parties = safeArray(effectiveGraph?.getParties?.());
  const relationships = safeArray(effectiveGraph?.getRelationships?.());
  const workItems = safeArray(workRuntime?.getWorkItems?.());
  const interactions = safeArray(interactionRuntime?.getInteractions?.());
  const messages = safeArray(communicationRuntime?.getMessages?.());
  const adapter = new EngagementViewAdapter({ nowISO });
  const peopleFilters = deepFreeze(safeArray(presentation?.peopleFilters));

  const rows = parties.map((party) => {
    const partyId = String(party.id);
    const partyRelationshipRows = collectPartyRelationships(partyId, relationships);
    const relationshipTypes = partyRelationshipRows.map((rel) => rel.type);
    const partyRequests = safeArray(requestRuntime?.getRequests?.()).filter((r) => String(r.requester) === partyId);
    const qualificationProfile = buildLatestQualificationProfile(partyRequests);
    const { subjectCount, primarySubjectId, primarySubjectName, subjectNames } = collectPartySubjectIds({
      partyId,
      relationships,
      partyRequests,
      businessSubjectRuntime,
    });
    const { email, phone } = resolvePartyContact(party);

    const relationshipLabels = relationshipTypes
      .map((rt) => relationshipDisplayLabel(presentation, rt))
      .filter(Boolean);
    const openRequestCount = partyRequests.filter((r) => isOpenRequestStatus(r.status)).length;
    const openWorkCount = workItems.filter(
      (w) => String(w.requestedBy) === partyId && isOpenWorkStatus(w.status),
    ).length;

    const partyInteractions = interactions.filter((i) =>
      safeArray(i.participants).some((p) => String(p.partyId) === partyId),
    );
    const partyMessages = messages.filter((m) =>
      safeArray(m.recipients).some((r) => String(r.id) === partyId) || String(m.sender?.id) === partyId,
    );

    const lastActivityAt = latestTimestamp(
      partyInteractions[partyInteractions.length - 1]?.occurredAt,
      partyMessages[partyMessages.length - 1]?.createdAt,
      partyRequests[partyRequests.length - 1]?.receivedAt,
    );

    let attentionLevel = "none";
    let nextActionTitle = null;
    try {
      const engagement = adapter.translate({
        partyId,
        businessGraphRuntime: effectiveGraph,
        businessSubjectRuntime,
        communicationPreferenceRuntime,
        segmentDefinitionRuntime,
        requestRuntime,
        workRuntime,
        communicationRuntime,
        interactionRuntime,
        automationRuntime,
        approvalRuntime,
      });
      if (engagement.attention.items.length > 0) attentionLevel = "attention";
      nextActionTitle = engagement.nextActions[0]?.title ?? null;
    } catch {
      attentionLevel = openWorkCount > 0 ? "attention" : "none";
    }

    return deepFreeze({
      partyId,
      displayName: String(party.displayName ?? partyId),
      partyType: String(party.partyType ?? "unknown"),
      partyTypeLabel: partyTypeDisplayLabel(presentation, party.partyType),
      email,
      phone,
      relationshipTypes: deepFreeze(relationshipTypes),
      relationshipLabels: deepFreeze(relationshipLabels),
      relationships: deepFreeze(partyRelationshipRows),
      partyStatus: String(party.status ?? "active"),
      qualificationProfile: deepFreeze(qualificationProfile),
      primarySubjectId,
      primarySubjectName,
      subjectNames: deepFreeze(subjectNames),
      subjectCount,
      openRequestCount,
      openWorkCount,
      attentionLevel,
      lastActivityAt,
      lastActivityLabel: formatBusinessDate(lastActivityAt, { nowISO }),
      nextActionTitle,
      href: businessId
        ? `/b/${String(businessId)}/people/${partyId}`
        : `/engagement/${partyId}`,
    });
  });

  return deepFreeze({
    generatedAt: String(nowISO ?? new Date().toISOString()),
    peopleFilters,
    parties: deepFreeze(rows.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)))),
  });
}
