import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createNormalizedInboundEvent } from "./NormalizedInboundEvent.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../../business-graph/BusinessGraphEventTypes.js";
import { REQUEST_EVENT_TYPES } from "../../request/RequestEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../../references/EntityRef.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../../business-subject/BusinessSubjectEventTypes.js";
import { createInteraction } from "../../interactions/Interaction.js";
import { INTERACTION_EVENT_TYPES } from "../../interactions/InteractionEventTypes.js";
import { isValidRequestPriority } from "../../request/RequestPriority.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function stablePartyIdFromEmail(email) {
  const normalized = safeString(email).toLowerCase().trim();
  if (!normalized) return null;
  return `party_${normalized.replace(/[@.]/g, "_")}`;
}

function stablePartyIdFromPhone(phone) {
  const digits = safeString(phone).replace(/\D/g, "");
  if (!digits) return null;
  return `party_phone_${digits}`;
}

/**
 * Maps normalized inbound events to canonical business facts via existing runtimes.
 */
export class InboundBusinessOrchestrationService {
  constructor({
    workspaceId,
    businessGraphRuntime,
    businessSubjectRuntime,
    requestRuntime,
    interactionRuntime,
    installationResult,
    requestPlatformEventPublisher = null,
    nowISO = "2026-07-01T00:00:00.000Z",
    processedDeliveries = null,
  } = {}) {
    this.workspaceId = String(workspaceId);
    this.businessGraphRuntime = businessGraphRuntime;
    this.businessSubjectRuntime = businessSubjectRuntime;
    this.requestRuntime = requestRuntime;
    this.interactionRuntime = interactionRuntime;
    this.installationResult = installationResult;
    this.requestPlatformEventPublisher = requestPlatformEventPublisher;
    this.nowISO = String(nowISO);
    this._processed = processedDeliveries ?? new Set();
  }

  isDuplicate({ providerId, externalEventId } = {}) {
    const key = `${this.workspaceId}:${providerId}:${externalEventId}`;
    return this._processed.has(key);
  }

  markProcessed({ providerId, externalEventId } = {}) {
    const key = `${this.workspaceId}:${providerId}:${externalEventId}`;
    this._processed.add(key);
  }

  handlePlatformEvent(event = {}) {
    if (String(event.eventType) !== "INBOUND_EVENT_RECEIVED") return { handled: false };

    const payload = event.payload ?? {};
    const normalized = createNormalizedInboundEvent({
      externalEventId: payload.externalEventId,
      providerId: payload.provider,
      workspaceId: this.workspaceId,
      channel: payload.channel,
      eventKind: payload.normalizedFacts?.eventKind ?? payload.eventType ?? "unknown",
      occurredAt: payload.occurredAt ?? event.occurredAt,
      identityHints: payload.normalizedFacts?.identityHints ?? {},
      attribution: payload.normalizedFacts?.attribution ?? {},
      payloadFacts: payload.normalizedFacts ?? {},
    });

    if (this.isDuplicate({ providerId: normalized.providerId, externalEventId: normalized.externalEventId })) {
      return { handled: true, duplicate: true };
    }
    this.markProcessed({ providerId: normalized.providerId, externalEventId: normalized.externalEventId });

    return this.handleNormalizedEvent(normalized);
  }

  handleNormalizedEvent(normalized) {
    const routing = this.#resolveRouting(normalized.eventKind);
    const partyId = this.#resolveOrCreateParty(normalized);
    const subjectRef = this.#resolveSubjectRef(normalized);

    if (partyId && routing?.partyRelationshipType) {
      this.#linkPartyToOrganization(partyId, routing.partyRelationshipType);
    }

    if (subjectRef && partyId) {
      this.#linkPartyToSubject(partyId, subjectRef, routing?.subjectRelationshipType ?? "INTERESTED_IN");
    }

    const requestId = `req_inbound_${normalized.externalEventId}`;
    const requestType = routing?.requestType ?? "GENERIC_INQUIRY";
    const payloadPriority = normalized.payloadFacts?.priority;
    const priority = isValidRequestPriority(payloadPriority)
      ? String(payloadPriority)
      : routing?.defaultPriority && isValidRequestPriority(routing.defaultPriority)
        ? String(routing.defaultPriority)
        : "medium";

    this.requestRuntime.applyEvent({
      id: `evt_req_inbound_${normalized.externalEventId}`,
      timestampISO: this.nowISO,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "inbound_orchestrator",
      payload: {
        request: {
          id: requestId,
          title: normalized.payloadFacts.title ?? `Inbound ${normalized.eventKind}`,
          description: normalized.payloadFacts.message ?? "",
          requestType,
          status: "received",
          priority,
          channel: normalized.channel ?? "website",
          source: normalized.attribution.sourceLabel ?? normalized.providerId,
          requester: partyId ?? "unknown",
          receivedAt: normalized.occurredAt ?? this.nowISO,
          dueAt: null,
          inboundAttribution: {
            inboundEventId: normalized.externalEventId,
            providerId: normalized.providerId,
            channel: normalized.channel,
            sourceLabel: normalized.attribution.sourceLabel ?? null,
            landingPage: normalized.attribution.landingPage ?? null,
            campaignId: normalized.attribution.campaignId ?? null,
            externalObjectId: normalized.attribution.externalObjectId ?? null,
            subjectRef,
          },
          subjectRefs: subjectRef ? [subjectRef] : [],
          metadata: { qualification: normalized.payloadFacts.qualification ?? {} },
        },
      },
    });

    const canonicalRequest = this.requestRuntime.getRequest(requestId);
    if (canonicalRequest && this.requestPlatformEventPublisher) {
      this.requestPlatformEventPublisher.publishRequestReceived({
        request: canonicalRequest,
        receivedAtISO: canonicalRequest.receivedAt ?? normalized.occurredAt ?? this.nowISO,
        sourceEventId: `evt_req_inbound_${normalized.externalEventId}`,
        metadata: { derivedFrom: { inboundEventId: normalized.externalEventId } },
      });
    }

    if (normalized.eventKind === "missed_call" && partyId && this.interactionRuntime) {
      const interactionId = `int_inbound_${normalized.externalEventId}`;
      const interaction = createInteraction({
        id: interactionId,
        interactionType: "call",
        direction: "inbound",
        channel: "phone",
        occurredAt: normalized.occurredAt ?? this.nowISO,
        participants: [{ partyId, participantType: "primary" }],
        relatedObjects: [
          createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: requestId }),
          createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        ],
        summary: "Missed call received",
        externalReference: normalized.externalEventId,
        metadata: {},
        createdAt: this.nowISO,
        updatedAt: this.nowISO,
      });
      this.interactionRuntime.applyEvent({
        id: `evt_int_inbound_${normalized.externalEventId}`,
        timestampISO: this.nowISO,
        type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
        source: "inbound_orchestrator",
        payload: { interaction },
      });
    }

    return deepFreeze({
      handled: true,
      partyId,
      requestId,
      subjectRef,
    });
  }

  #resolveRouting(eventKind) {
    const routes = this.installationResult?.inboundRouting ?? [];
    return routes.find((r) => String(r.eventKind) === String(eventKind)) ?? null;
  }

  #resolveOrCreateParty(normalized) {
    const hints = normalized.identityHints ?? {};
    const email = safeString(hints.email);
    const phone = safeString(hints.phone);
    const submittedName = safeString(hints.name);
    const name = submittedName || email || phone || "Unknown";

    const existing = this.businessGraphRuntime.getParties().find((p) => {
      const methods = p.contactMethods ?? [];
      return (email && methods.includes(email)) || (phone && methods.includes(phone));
    });

    if (existing) {
      this.#maybeUpdatePartyDisplayName({
        partyId: String(existing.id),
        submittedName,
        externalEventId: normalized.externalEventId,
      });
      return String(existing.id);
    }

    const partyId =
      stablePartyIdFromEmail(email) ??
      stablePartyIdFromPhone(phone) ??
      `party_inbound_${normalized.externalEventId}`;

    if (this.businessGraphRuntime.getParty(partyId)) {
      this.#maybeUpdatePartyDisplayName({
        partyId,
        submittedName,
        externalEventId: normalized.externalEventId,
      });
      return partyId;
    }

    this.businessGraphRuntime.applyEvent({
      id: `evt_party_inbound_${normalized.externalEventId}`,
      timestampISO: this.nowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
      source: "inbound_orchestrator",
      payload: {
        party: {
          id: partyId,
          partyType: "PERSON",
          displayName: name,
          status: "active",
          contactMethods: [email, phone].filter(Boolean),
          externalReferences: [],
          metadata: { source: normalized.providerId },
          createdAt: this.nowISO,
          updatedAt: this.nowISO,
        },
      },
    });
    return partyId;
  }

  #maybeUpdatePartyDisplayName({ partyId, submittedName, externalEventId } = {}) {
    const nextName = safeString(submittedName);
    if (!nextName) return;

    const party = this.businessGraphRuntime.getParty(String(partyId));
    if (!party || String(party.displayName) === nextName) return;

    this.businessGraphRuntime.applyEvent({
      id: `evt_party_name_inbound_${externalEventId}`,
      timestampISO: this.nowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_UPDATED,
      source: "inbound_orchestrator",
      payload: {
        partyId: String(partyId),
        patch: { displayName: nextName },
      },
    });
  }

  #resolveSubjectRef(normalized) {
    const extId = normalized.attribution?.externalObjectId;
    if (!extId) return null;

    const extIdStr = String(extId);
    const subjectType = normalized.attribution?.subjectType ?? "subject";

    const byCanonicalId = this.businessSubjectRuntime.getSubject(extIdStr);
    if (byCanonicalId) {
      return createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: String(byCanonicalId.id) });
    }

    let subject = this.businessSubjectRuntime
      .getSubjects()
      .find((s) => s.externalReferences.includes(extIdStr));

    if (!subject) {
      const subjectId = `subj_${extIdStr}`;
      if (this.businessSubjectRuntime.getSubject(subjectId)) {
        subject = this.businessSubjectRuntime.getSubject(subjectId);
      } else {
        this.businessSubjectRuntime.applyEvent({
          id: `evt_subj_inbound_${extIdStr}`,
          timestampISO: this.nowISO,
          type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
          source: "inbound_orchestrator",
          payload: {
            subject: {
              id: subjectId,
              workspaceId: this.workspaceId,
              subjectType,
              displayName: normalized.attribution?.subjectDisplayName ?? extIdStr,
              status: "active",
              keyAttributes: normalized.attribution?.subjectAttributes ?? {},
              externalReferences: [extIdStr],
              createdAt: this.nowISO,
              updatedAt: this.nowISO,
            },
          },
        });
        subject = this.businessSubjectRuntime.getSubject(subjectId);
      }
    }

    return createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: String(subject.id) });
  }

  #linkPartyToOrganization(partyId, relationshipType) {
    const type = String(relationshipType ?? "").trim();
    if (!type) return;

    const relId = `rel_${type}_${partyId}`;
    if (this.businessGraphRuntime.getRelationship(relId)) return;

    this.businessGraphRuntime.applyEvent({
      id: `evt_rel_org_inbound_${relId}`,
      timestampISO: this.nowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
      source: "inbound_orchestrator",
      payload: {
        relationship: {
          id: relId,
          fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
          toEntity: { entityType: ENTITY_TYPES.ORGANIZATION, entityId: "org_workspace" },
          relationshipType: type,
          status: "active",
          effectiveFrom: this.nowISO,
          effectiveTo: null,
          metadata: {},
          createdAt: this.nowISO,
          updatedAt: this.nowISO,
        },
      },
    });
  }

  #linkPartyToSubject(partyId, subjectRef, relationshipType = "INTERESTED_IN") {
    const type = String(relationshipType ?? "INTERESTED_IN");
    const relId = `rel_${type}_${partyId}_${subjectRef.entityId}`;
    if (this.businessGraphRuntime.getRelationship(relId)) return;

    this.businessGraphRuntime.applyEvent({
      id: `evt_rel_inbound_${relId}`,
      timestampISO: this.nowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
      source: "inbound_orchestrator",
      payload: {
        relationship: {
          id: relId,
          fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
          toEntity: subjectRef,
          relationshipType: type,
          status: "active",
          effectiveFrom: this.nowISO,
          effectiveTo: null,
          metadata: {},
          createdAt: this.nowISO,
          updatedAt: this.nowISO,
        },
      },
    });
  }
}
