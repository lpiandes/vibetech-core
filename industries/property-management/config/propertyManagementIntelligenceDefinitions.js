/**
 * Property Management package Business Intelligence contributions.
 * Registers without modifying central evaluators.
 * Uses BusinessSubject + INTERESTED_IN + Request.subjectRefs + Interaction.relatedObjects only.
 */
import { contributeBusinessIntelligenceDefinitions } from "../../../backend/core/business-intelligence/packageContribution.js";
import { registerDefaultBusinessIntelligenceDefinitions } from "../../../backend/core/business-intelligence/registerDefaultBusinessIntelligenceDefinitions.js";
import { createEvidenceReference } from "../../../backend/core/business-intelligence/evidence/EvidenceReference.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../../../backend/core/workspace/activation/activateWorkspace.js";

function daysBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

function workAction(label) {
  return {
    actionId: "create_work",
    kind: "create_work",
    label,
    workTemplate: { workType: "intelligence_follow_up", priority: "high" },
    requiresApproval: true,
  };
}

const PM_AVAILABILITY = Object.freeze({
  defaultEnabled: true,
  industryPackageIds: [PROPERTY_MANAGEMENT_PACKAGE_ID, "pkg_property_management"],
});

function relationshipPartyId(rel) {
  if (rel.fromPartyId) return rel.fromPartyId;
  if (rel.fromEntity?.entityId && String(rel.fromEntity.entityType).toUpperCase().includes("PARTY")) {
    return rel.fromEntity.entityId;
  }
  return rel.partyId ?? null;
}

function relationshipSubjectId(rel) {
  if (rel.toSubjectId) return rel.toSubjectId;
  if (rel.toEntity?.entityId && /SUBJECT|BUSINESS_SUBJECT/i.test(String(rel.toEntity.entityType ?? ""))) {
    return rel.toEntity.entityId;
  }
  return rel.subjectId ?? null;
}

function evaluateStaleImmediateBuyers({ stack, businessId, nowISO, thresholds }) {
  const staleDays = Number(thresholds?.staleAfterDays ?? 14);
  const results = [];
  const relationships = stack.businessGraphRuntime?.getRelationships?.()
    ?? stack.businessGraphRuntime?.listRelationships?.()
    ?? [];
  const interested = relationships.filter((rel) => {
    const type = String(rel.type ?? rel.relationshipType ?? "").toUpperCase();
    return type.includes("INTERESTED") || type === "INTERESTED_IN";
  });

  for (const rel of interested) {
    const partyId = relationshipPartyId(rel);
    const subjectId = relationshipSubjectId(rel);
    if (!partyId) continue;

    const party = stack.businessGraphRuntime?.getParty?.(partyId);
    const timeline = String(
      rel.attributes?.timeline
      ?? rel.metadata?.timeline
      ?? rel.metadata?.decisionTimeline
      ?? party?.attributes?.timeline
      ?? party?.metadata?.timeline
      ?? "",
    ).toLowerCase();
    const immediate = !timeline
      || timeline.includes("immediate")
      || timeline.includes("asap")
      || timeline.includes("urgent");
    if (!immediate) continue;

    const interactions = (stack.interactionRuntime?.getInteractions?.() ?? []).filter((entry) => (
      String(entry.partyId ?? "") === String(partyId)
      || (entry.participants ?? []).some((p) => String(p.partyId) === String(partyId))
      || (entry.relatedObjects ?? []).some((ref) => (
        String(ref.objectType ?? ref.entityType ?? "").toLowerCase().includes("party")
        && String(ref.objectId ?? ref.entityId) === String(partyId)
      ))
    ));
    const latest = interactions.map((e) => e.occurredAt ?? e.createdAt).filter(Boolean).sort().at(-1);
    const age = latest ? daysBetween(latest, nowISO) : staleDays + 1;
    if (age == null || age < staleDays) continue;

    const evidence = [
      createEvidenceReference({
        objectType: "party",
        objectId: partyId,
        businessId,
        field: "displayName",
        observedValue: party?.displayName ?? null,
        observedAt: nowISO,
        explanation: `${party?.displayName ?? partyId} has an INTERESTED_IN relationship.`,
      }),
      createEvidenceReference({
        objectType: "relationship",
        objectId: rel.id ?? `${partyId}:INTERESTED_IN`,
        businessId,
        field: "type",
        observedValue: rel.type ?? rel.relationshipType ?? "INTERESTED_IN",
        observedAt: nowISO,
        explanation: "Active property interest with no recent meaningful interaction.",
      }),
    ];
    if (subjectId) {
      evidence.push(createEvidenceReference({
        objectType: "business_subject",
        objectId: subjectId,
        businessId,
        field: "id",
        observedValue: subjectId,
        observedAt: nowISO,
        explanation: "Interest targets a BusinessSubject (listing/property).",
      }));
    }

    results.push({
      subjectKey: `pm_buyer_stale:${partyId}:${subjectId ?? "none"}`,
      title: "Immediate-timeline buyer going stale",
      summary: `${party?.displayName ?? partyId} shows property interest but no meaningful activity in ${staleDays}+ days.`,
      explanation: latest ? `Last activity ${latest} (${age} days ago).` : "No interactions recorded.",
      severity: "high",
      confidence: 0.82,
      confidenceReason: `INTERESTED_IN + ${staleDays}+ days without meaningful interaction.`,
      evidence,
      missingEvidence: latest ? [] : ["interaction.latestMeaningfulActivityAt"],
      relatedObjectRefs: [
        { objectType: "party", objectId: partyId },
        ...(subjectId ? [{ objectType: "business_subject", objectId: subjectId }] : []),
      ],
    });
  }
  return results;
}

function evaluateStaleSellerProspects({ stack, businessId, nowISO, thresholds }) {
  const staleDays = Number(thresholds?.staleAfterDays ?? 21);
  const results = [];
  const relationships = stack.businessGraphRuntime?.listRelationships?.()
    ?? stack.businessGraphRuntime?.getRelationships?.()
    ?? [];
  for (const rel of relationships) {
    const type = String(rel.type ?? rel.relationshipType ?? "").toUpperCase();
    if (!type.includes("SELLER") && type !== "OWNER_PROSPECT") continue;
    const partyId = rel.fromPartyId ?? rel.partyId;
    if (!partyId) continue;
    const interactions = (stack.interactionRuntime?.getInteractions?.() ?? []).filter((entry) => (
      String(entry.partyId ?? "") === String(partyId)
    ));
    const latest = interactions.map((e) => e.occurredAt ?? e.createdAt).filter(Boolean).sort().at(-1);
    const age = latest ? daysBetween(latest, nowISO) : staleDays + 1;
    if (age == null || age < staleDays) continue;
    const party = stack.businessGraphRuntime?.getParty?.(partyId);
    results.push({
      subjectKey: `pm_seller_stale:${partyId}`,
      title: "Stale seller prospect",
      summary: `${party?.displayName ?? partyId} seller prospect is stale.`,
      explanation: latest ? `Last activity ${latest}.` : "No recent seller-prospect interaction.",
      severity: "medium",
      confidence: 0.78,
      confidenceReason: `Seller/owner prospect without activity for ${staleDays}+ days.`,
      evidence: [
        createEvidenceReference({
          objectType: "party",
          objectId: partyId,
          businessId,
          observedAt: nowISO,
          explanation: "Seller prospect party.",
        }),
        createEvidenceReference({
          objectType: "relationship",
          objectId: rel.id ?? `${partyId}:SELLER`,
          businessId,
          field: "type",
          observedValue: type,
          observedAt: nowISO,
          explanation: `Relationship type ${type} is active without recent interaction.`,
        }),
      ],
      relatedObjectRefs: [{ objectType: "party", objectId: partyId }],
    });
  }
  return results;
}

function evaluatePropertyInterestClusters({ stack, businessId, nowISO, thresholds }) {
  const minInterests = Number(thresholds?.minInterests ?? 3);
  const bySubject = new Map();
  const relationships = stack.businessGraphRuntime?.listRelationships?.()
    ?? stack.businessGraphRuntime?.getRelationships?.()
    ?? [];
  for (const rel of relationships) {
    const type = String(rel.type ?? rel.relationshipType ?? "").toUpperCase();
    if (!type.includes("INTERESTED")) continue;
    const subjectId = rel.toSubjectId ?? rel.subjectId ?? rel.targetSubjectId;
    if (!subjectId) continue;
    if (!bySubject.has(String(subjectId))) bySubject.set(String(subjectId), []);
    bySubject.get(String(subjectId)).push(rel);
  }
  const results = [];
  for (const [subjectId, group] of bySubject.entries()) {
    if (group.length < minInterests) continue;
    const subject = stack.businessSubjectRuntime?.getSubject?.(subjectId);
    results.push({
      subjectKey: `pm_demand_cluster:${subjectId}`,
      title: "Property-interest demand cluster",
      summary: `${group.length} parties are interested in ${subject?.displayName ?? subjectId}.`,
      explanation: "Multiple INTERESTED_IN relationships target the same BusinessSubject.",
      severity: "medium",
      confidence: 0.85,
      confidenceReason: `Counted ${group.length} INTERESTED_IN links (threshold ${minInterests}).`,
      evidence: [
        createEvidenceReference({
          objectType: "business_subject",
          objectId: subjectId,
          businessId,
          field: "interestCount",
          observedValue: group.length,
          comparison: ">=",
          threshold: minInterests,
          observedAt: nowISO,
          explanation: `Demand cluster on subject ${subject?.displayName ?? subjectId}.`,
        }),
      ],
      relatedObjectRefs: [{ objectType: "business_subject", objectId: subjectId }],
    });
  }
  return results;
}

function evaluateUnresolvedShowing({ stack, businessId, nowISO }) {
  const results = [];
  for (const request of stack.requestRuntime?.getRequests?.() ?? []) {
    const type = String(request.requestType ?? request.type ?? "").toLowerCase();
    if (!type.includes("showing")) continue;
    if (["completed", "cancelled", "closed"].includes(String(request.status))) continue;
    const subjectId = request.subjectRefs?.[0]?.entityId ?? request.subjectRefs?.[0]?.objectId;
    results.push({
      subjectKey: `pm_showing:${request.id}`,
      title: "Unresolved showing coordination",
      summary: `Showing request ${request.title ?? request.id} is still open.`,
      explanation: "Showing coordination request remains unresolved.",
      severity: "high",
      confidence: 0.9,
      confidenceReason: "Open showing request exists in Request runtime.",
      evidence: [
        createEvidenceReference({
          objectType: "request",
          objectId: request.id,
          businessId,
          field: "status",
          observedValue: request.status,
          observedAt: nowISO,
          explanation: "Unresolved showing coordination request.",
        }),
        ...(subjectId ? [createEvidenceReference({
          objectType: "business_subject",
          objectId: subjectId,
          businessId,
          observedAt: nowISO,
          explanation: "Showing is linked via Request.subjectRefs.",
        })] : []),
      ],
      relatedObjectRefs: [
        { objectType: "request", objectId: request.id },
        ...(subjectId ? [{ objectType: "business_subject", objectId: subjectId }] : []),
      ],
    });
  }
  return results;
}

function evaluateMaintenanceResponse({ stack, businessId, nowISO, thresholds }) {
  const maxHours = Number(thresholds?.maxResponseHours ?? 24);
  const results = [];
  for (const request of stack.requestRuntime?.getRequests?.() ?? []) {
    const type = String(request.requestType ?? request.type ?? "").toLowerCase();
    if (!type.includes("maintenance")) continue;
    if (["completed", "cancelled", "closed"].includes(String(request.status))) continue;
    const created = request.createdAt ?? request.receivedAt;
    const ageHours = created
      ? Math.floor((Date.parse(nowISO) - Date.parse(created)) / (60 * 60 * 1000))
      : maxHours + 1;
    if (ageHours < maxHours) continue;
    results.push({
      subjectKey: `pm_maintenance_sla:${request.id}`,
      title: "Maintenance request exceeding response expectations",
      summary: `Maintenance request ${request.title ?? request.id} is open ${ageHours}+ hours.`,
      explanation: `Exceeds configured response expectation of ${maxHours} hours.`,
      severity: "high",
      confidence: 0.88,
      confidenceReason: `Open maintenance request age ${ageHours}h > ${maxHours}h threshold.`,
      evidence: [createEvidenceReference({
        objectType: "request",
        objectId: request.id,
        businessId,
        field: "createdAt",
        observedValue: created ?? null,
        comparison: "older_than_hours",
        threshold: maxHours,
        observedAt: nowISO,
        explanation: "Maintenance request exceeded response expectation.",
      })],
      relatedObjectRefs: [{ objectType: "request", objectId: request.id }],
    });
  }
  return results;
}

function evaluateReferralFollowUp({ stack, businessId, nowISO, thresholds }) {
  const staleDays = Number(thresholds?.staleAfterDays ?? 7);
  const results = [];
  const relationships = stack.businessGraphRuntime?.listRelationships?.()
    ?? stack.businessGraphRuntime?.getRelationships?.()
    ?? [];
  for (const rel of relationships) {
    const type = String(rel.type ?? rel.relationshipType ?? "").toUpperCase();
    if (!type.includes("REFERRAL")) continue;
    const partyId = rel.fromPartyId ?? rel.partyId;
    if (!partyId) continue;
    const interactions = (stack.interactionRuntime?.getInteractions?.() ?? []).filter((entry) => (
      String(entry.partyId ?? "") === String(partyId)
    ));
    const latest = interactions.map((e) => e.occurredAt ?? e.createdAt).filter(Boolean).sort().at(-1);
    const age = latest ? daysBetween(latest, nowISO) : staleDays + 1;
    if (age == null || age < staleDays) continue;
    results.push({
      subjectKey: `pm_referral:${partyId}:${rel.id ?? "rel"}`,
      title: "Referral relationship requiring follow-up",
      summary: `Referral relationship for ${partyId} needs follow-up.`,
      explanation: "Referral relationship has no recent meaningful interaction.",
      severity: "medium",
      confidence: 0.8,
      confidenceReason: `Referral relationship stale for ${staleDays}+ days.`,
      evidence: [
        createEvidenceReference({
          objectType: "relationship",
          objectId: rel.id ?? `${partyId}:REFERRAL`,
          businessId,
          field: "type",
          observedValue: type,
          observedAt: nowISO,
          explanation: "Referral relationship requires follow-up.",
        }),
        createEvidenceReference({
          objectType: "party",
          objectId: partyId,
          businessId,
          observedAt: nowISO,
          explanation: "Referral party.",
        }),
      ],
      relatedObjectRefs: [{ objectType: "party", objectId: partyId }],
    });
  }
  return results;
}

function evaluateMissingListingPresentation({ stack, businessId, nowISO }) {
  const results = [];
  for (const subject of stack.businessSubjectRuntime?.getSubjects?.() ?? []) {
    const type = String(subject.subjectType ?? subject.type ?? "").toLowerCase();
    if (!["property", "listing", "unit"].includes(type)) continue;
    const missing = [];
    if (!subject.displayName && !subject.title) missing.push("displayName");
    if (!subject.presentation?.summary && !subject.attributes?.summary && !subject.description) {
      missing.push("presentation.summary");
    }
    if (subject.metadata?.missingRequiredInformation) {
      missing.push(...(subject.metadata.missingFields ?? ["required_presentation"]));
    }
    if (!missing.length) continue;
    results.push({
      subjectKey: `pm_listing_incomplete:${subject.id}`,
      title: "Property/listing missing required presentation information",
      summary: `${subject.displayName ?? subject.id} is missing: ${[...new Set(missing)].join(", ")}.`,
      explanation: "Listing/property BusinessSubject lacks required presentation fields.",
      severity: "medium",
      confidence: 0.9,
      confidenceReason: "Canonical BusinessSubject presentation fields are incomplete.",
      evidence: [createEvidenceReference({
        objectType: "business_subject",
        objectId: subject.id,
        businessId,
        field: missing[0],
        observedValue: null,
        comparison: "is_null",
        observedAt: nowISO,
        explanation: `Missing presentation fields: ${[...new Set(missing)].join(", ")}.`,
      })],
      missingEvidence: [...new Set(missing)],
      relatedObjectRefs: [{ objectType: "business_subject", objectId: subject.id }],
    });
  }
  return results;
}

function triple(obsId, title, description, category, evaluatorId, thresholds = {}) {
  const insightId = obsId.replace(/^obs_/, "ins_");
  const recId = obsId.replace(/^obs_/, "rec_");
  return {
    observation: {
      definitionId: obsId,
      version: "1.0.0",
      title,
      description,
      category,
      evaluatorId,
      thresholds,
      availability: PM_AVAILABILITY,
    },
    insight: {
      definitionId: insightId,
      version: "1.0.0",
      title,
      description,
      category,
      requiredObservationDefinitionIds: [obsId],
      explanationTemplate: "{{explanation}}",
      availability: PM_AVAILABILITY,
    },
    recommendation: {
      definitionId: recId,
      version: "1.0.0",
      title: `Act on: ${title}`,
      description: `Recommended response for ${title}.`,
      category,
      sourceInsightDefinitionIds: [insightId],
      recommendedActions: [workAction("Create follow-up work")],
      availability: PM_AVAILABILITY,
    },
  };
}

export function registerPropertyManagementIntelligenceDefinitions(registry) {
  registerDefaultBusinessIntelligenceDefinitions({ registry });

  const triples = [
    triple(
      "obs_pm_stale_immediate_buyers",
      "Immediate-timeline active buyers with no recent meaningful activity",
      "Buyers with INTERESTED_IN and immediate timeline going stale.",
      "relationship",
      "obs_pm_stale_immediate_buyers",
      { staleAfterDays: 14 },
    ),
    triple(
      "obs_pm_stale_seller_prospects",
      "Stale seller prospects",
      "Seller/owner prospects without recent activity.",
      "relationship",
      "obs_pm_stale_seller_prospects",
      { staleAfterDays: 21 },
    ),
    triple(
      "obs_pm_property_interest_clusters",
      "Property-interest demand clusters",
      "Multiple INTERESTED_IN links on one BusinessSubject.",
      "opportunity",
      "obs_pm_property_interest_clusters",
      { minInterests: 3 },
    ),
    triple(
      "obs_pm_unresolved_showing",
      "Unresolved showing coordination",
      "Open showing requests needing coordination.",
      "workflow",
      "obs_pm_unresolved_showing",
    ),
    triple(
      "obs_pm_maintenance_response",
      "Maintenance requests exceeding response expectations",
      "Maintenance requests past configured response hours.",
      "workflow",
      "obs_pm_maintenance_response",
      { maxResponseHours: 24 },
    ),
    triple(
      "obs_pm_referral_follow_up",
      "Referral relationships requiring follow-up",
      "Referral relationships without recent activity.",
      "relationship",
      "obs_pm_referral_follow_up",
      { staleAfterDays: 7 },
    ),
    triple(
      "obs_pm_listing_missing_presentation",
      "Property/listing subjects missing required presentation information",
      "Listing/property BusinessSubjects incomplete for presentation.",
      "data_quality",
      "obs_pm_listing_missing_presentation",
    ),
  ];

  return contributeBusinessIntelligenceDefinitions({
    source: "package:property_management",
    registry,
    evaluators: {
      obs_pm_stale_immediate_buyers: evaluateStaleImmediateBuyers,
      obs_pm_stale_seller_prospects: evaluateStaleSellerProspects,
      obs_pm_property_interest_clusters: evaluatePropertyInterestClusters,
      obs_pm_unresolved_showing: evaluateUnresolvedShowing,
      obs_pm_maintenance_response: evaluateMaintenanceResponse,
      obs_pm_referral_follow_up: evaluateReferralFollowUp,
      obs_pm_listing_missing_presentation: evaluateMissingListingPresentation,
    },
    observations: triples.map((t) => t.observation),
    insights: triples.map((t) => t.insight),
    recommendations: triples.map((t) => t.recommendation),
  });
}
