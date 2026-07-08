import { COMMUNICATION_EVENT_TYPES } from "../communications/CommunicationEventTypes.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { RelationshipFollowUpDraftContextAssembler } from "./RelationshipFollowUpDraftContextAssembler.js";

function sanitizeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "_");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function renderTemplate(template, data) {
  return String(template ?? "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, key) => String(data[key] ?? ""));
}

function qualificationLine(qualification) {
  const bits = [];
  if (qualification?.intent) bits.push(`intent: ${qualification.intent}`);
  if (qualification?.decisionTimeline) bits.push(`timeline: ${qualification.decisionTimeline}`);
  if (!bits.length) return "";
  return `I have your current notes as ${bits.join(", ")}. `;
}

function knowledgeLine(knowledge) {
  if (!safeArray(knowledge).length) return "";
  return `I also checked current approved guidance: ${knowledge.map((doc) => doc.title).join(", ")}. `;
}

function draftIdentity(workId) {
  const safe = sanitizeId(workId);
  return {
    threadId: `thread_work_assist_${safe}_relationship_followup_v1`,
    messageId: `msg_work_assist_${safe}_relationship_followup_v1`,
  };
}

function relatedObjectsFor({ work, context }) {
  return [
    createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: String(work.id) }),
    context.party?.id ? createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: String(context.party.id) }) : null,
    context.subject?.id ? createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: String(context.subject.id) }) : null,
    context.evidence?.relatedObjects?.find?.((ref) => String(ref?.entityType) === ENTITY_TYPES.REQUEST) ?? null,
  ].filter(Boolean);
}

export class RelationshipFollowUpDraftAssistanceService {
  constructor({ contextAssembler = new RelationshipFollowUpDraftContextAssembler() } = {}) {
    this.contextAssembler = contextAssembler;
  }

  execute({ stack, installationResult, businessId, workId, actorId = "tm_system", knowledgeDocuments = [], nowISO = new Date().toISOString() } = {}) {
    if (!stack?.communicationRuntime) {
      throw new Error("RelationshipFollowUpDraftAssistanceService requires communicationRuntime.");
    }
    const context = this.contextAssembler.assemble({ stack, installationResult, businessId, workId, knowledgeDocuments });
    if (!context.ok) return context;
    if (!context.assistanceRule) {
      return { ok: false, reason: "no_assistance_rule", errors: ["No package draft assistance rule applies to this relationship."] };
    }

    const { threadId, messageId } = draftIdentity(context.work.id);
    const existingMessage = stack.communicationRuntime.getMessage(messageId);
    if (existingMessage) {
      return {
        ok: true,
        workId: String(context.work.id),
        threadId,
        messageId,
        draft: existingMessage,
        idempotent: true,
        context: summarizeContext(context),
        snapshotKinds: [],
      };
    }

    const data = {
      personName: String(context.party.displayName ?? "there"),
      relationshipLabel: String(context.evidence.relationshipLabel ?? context.relationship.relationshipType),
      propertyName: context.subject?.displayName ?? context.evidence.propertyInterest?.value ?? "the property",
      propertyClause: context.subject?.displayName ? ` in ${context.subject.displayName}` : "",
      qualificationLine: qualificationLine(context.qualification),
      knowledgeLine: knowledgeLine(context.knowledge),
    };
    const subject = renderTemplate(context.assistanceRule.subjectTemplate, data);
    const body = renderTemplate(context.assistanceRule.bodyTemplate, data);
    const relatedObjects = relatedObjectsFor({ work: context.work, context });

    if (!stack.communicationRuntime.getThread(threadId)) {
      stack.communicationRuntime.applyEvent({
        id: `evt_${threadId}_created`,
        timestampISO: nowISO,
        type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
        source: "relationship_followup_draft_assistance",
        payload: {
          thread: {
            id: threadId,
            subject,
            channel: "internal",
            status: "draft",
            participants: [
              { id: String(actorId ?? "tm_system"), type: "human" },
              { id: String(context.party.id), type: "party" },
            ],
            messageIds: [],
            relatedObjects,
            createdAt: nowISO,
            updatedAt: nowISO,
            metadata: { workAssistanceDraft: { workId: String(context.work.id), assistanceType: "relationship_followup" } },
          },
        },
      });
    }

    const message = {
      id: messageId,
      threadId,
      direction: "outbound",
      channel: "internal",
      status: "draft",
      sender: { id: String(actorId ?? "tm_system"), type: "human" },
      recipients: [{ id: String(context.party.id), type: "party" }],
      subject,
      body,
      createdAt: nowISO,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      relatedObjects,
      metadata: {
        workAssistanceDraft: {
          workId: String(context.work.id),
          assistanceType: "relationship_followup",
          version: "v1",
          recommendedChannel: context.channelGuidance.recommendedChannel,
          channelGuidance: context.channelGuidance,
          packageRuleId: context.assistanceRule.id,
          packageGuidance: context.assistanceRule.guidance ?? null,
          knowledgeSources: context.knowledge,
          evidence: summarizeContext(context),
          sendPermissionImplied: false,
        },
      },
    };

    stack.communicationRuntime.applyEvent({
      id: `evt_${messageId}_drafted`,
      timestampISO: nowISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
      source: "relationship_followup_draft_assistance",
      payload: { message },
    });

    return {
      ok: true,
      workId: String(context.work.id),
      threadId,
      messageId,
      draft: stack.communicationRuntime.getMessage(messageId),
      idempotent: false,
      context: summarizeContext(context),
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.COMMUNICATION],
    };
  }
}

export function summarizeContext(context) {
  return {
    party: { partyId: String(context.party.id), displayName: String(context.party.displayName ?? "") },
    relationship: {
      relationshipId: String(context.relationship.id),
      relationshipType: String(context.relationship.relationshipType),
      label: String(context.evidence.relationshipLabel ?? context.relationship.relationshipType),
    },
    property: context.subject
      ? { source: "subject_linkage", subjectId: String(context.subject.id), displayName: String(context.subject.displayName) }
      : context.evidence.propertyInterest
        ? { source: String(context.evidence.propertyInterest.source), value: String(context.evidence.propertyInterest.value) }
        : null,
    rawPropertyInterest: context.evidence.propertyInterest?.rawQualificationValue ?? null,
    qualification: context.qualification ?? {},
    latestMeaningfulActivityAt: context.evidence.latestMeaningfulActivityAt ?? null,
    importedNotes: context.evidence.importedNotes ?? [],
    channelGuidance: context.channelGuidance,
    knowledgeSources: context.knowledge,
  };
}
