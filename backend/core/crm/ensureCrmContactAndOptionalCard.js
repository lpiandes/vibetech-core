/**
 * Shared CRM write path: upsert contact (id === partyId), optional pipeline card,
 * persist CrmStore, best-effort PARTY_CREATED dual-write into the business graph.
 */
import crypto from "node:crypto";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import {
  readCrmState,
  writeCrmState,
  upsertContact,
  upsertPipelineCard,
} from "./CrmStore.js";
import { findCardAndStage, buildPipelineCardEventPayload } from "./pipelineCardEventPayload.js";

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * @param {object} crm
 * @param {{ id?: string, partyId?: string, email?: string, phone?: string }} [needle]
 */
export function findContact(crm, needle = {}) {
  const id = String(needle.id ?? needle.partyId ?? "").trim();
  const email = normalizeEmail(needle.email);
  const phone = normalizePhone(needle.phone);
  const contacts = Array.isArray(crm?.contacts) ? crm.contacts : [];
  if (id) {
    const byId = contacts.find((c) => String(c.id) === id || String(c.partyId) === id);
    if (byId) return byId;
  }
  if (email) {
    const byEmail = contacts.find((c) => normalizeEmail(c.email) === email);
    if (byEmail) return byEmail;
  }
  if (phone && phone.length >= 7) {
    const byPhone = contacts.find((c) => normalizePhone(c.phone) === phone);
    if (byPhone) return byPhone;
  }
  return null;
}

/**
 * Pure CrmStore mutation (no I/O).
 * @returns {{
 *   crm: object,
 *   contact: object,
 *   cardId: string|null,
 *   cardCreated: boolean,
 *   pipelineId: string|null,
 *   created: boolean,
 *   updated: boolean,
 * }}
 */
export function ensureCrmContactAndOptionalCard(crm, {
  contact = {},
  addToPipeline = false,
  pipelineId = null,
  stageId = null,
  cardId = null,
  cardTitle = null,
  skipExistingCard = true,
} = {}) {
  const existing = findContact(crm, contact);
  const id = String(
    contact.id
      || contact.partyId
      || existing?.id
      || `contact_${crypto.randomUUID().slice(0, 10)}`,
  ).trim();

  const nextContactInput = {
    ...existing,
    ...contact,
    id,
    partyId: String(contact.partyId ?? existing?.partyId ?? id),
    name: String(contact.name ?? existing?.name ?? "").trim() || "Unnamed",
    email: String(contact.email ?? existing?.email ?? "").trim(),
    phone: String(contact.phone ?? existing?.phone ?? "").trim(),
    kind: contact.kind ?? existing?.kind ?? "lead",
    tags: Array.isArray(contact.tags)
      ? contact.tags
      : (existing?.tags ?? []),
    notes: contact.notes != null ? String(contact.notes) : (existing?.notes ?? ""),
    ownerUserId: contact.ownerUserId !== undefined
      ? contact.ownerUserId
      : (existing?.ownerUserId ?? null),
    createdAt: existing?.createdAt,
  };

  // Keep id === partyId for Open person alignment
  nextContactInput.partyId = nextContactInput.id;

  let nextCrm = upsertContact(crm, nextContactInput);
  const saved = findContact(nextCrm, { id: nextContactInput.id });
  const created = !existing;
  const updated = Boolean(existing);

  let resolvedCardId = null;
  let resolvedPipelineId = null;
  let cardCreated = false;
  if (addToPipeline) {
    const pipes = Array.isArray(nextCrm.pipelines) ? nextCrm.pipelines : [];
    const pipe = pipes.find((p) => String(p.id) === String(pipelineId))
      || pipes[0]
      || null;
    if (pipe) {
      resolvedPipelineId = pipe.id;
      const stage = (pipe.stages ?? []).find((s) => String(s.id) === String(stageId))
        || pipe.stages?.[0]
        || null;
      const existingCard = (pipe.cards ?? []).find(
        (c) => String(c.contactId) === String(saved.id)
          || String(c.partyId) === String(saved.id),
      );
      if (existingCard && skipExistingCard) {
        resolvedCardId = existingCard.id;
      } else if (stage?.id) {
        const upserted = upsertPipelineCard(nextCrm, {
          pipelineId: pipe.id,
          card: {
            id: cardId || existingCard?.id || `card_${saved.id}`.slice(0, 64),
            title: cardTitle || saved.name || "Opportunity",
            stageId: stage.id,
            contactId: saved.id,
            partyId: saved.id,
            value: 0,
          },
        });
        nextCrm = upserted.crm;
        resolvedCardId = upserted.cardId;
        // A new card is created only when there was no pre-existing card for this
        // contact — a rename/update of an existing card must never fire *_CREATED.
        cardCreated = !existingCard;
      }
    }
  }

  return {
    crm: nextCrm,
    contact: findContact(nextCrm, { id: saved.id }),
    cardId: resolvedCardId,
    cardCreated,
    pipelineId: resolvedPipelineId,
    created,
    updated,
  };
}

/**
 * Best-effort graph party with the same id as the CRM contact.
 * @returns {{ ok: boolean, existed?: boolean, created?: boolean, skipped?: boolean, reason?: string }}
 */
export function tryDualWriteParty({
  businessGraphRuntime = null,
  contact = null,
  source = "crm",
  nowISO = new Date().toISOString(),
} = {}) {
  if (!businessGraphRuntime?.applyEvent || !contact?.id) {
    return { ok: false, skipped: true, reason: "graph_unavailable" };
  }
  const partyId = String(contact.id);
  try {
    if (typeof businessGraphRuntime.getParty === "function" && businessGraphRuntime.getParty(partyId)) {
      return { ok: true, existed: true };
    }
  } catch {
    /* treat as missing */
  }

  try {
    businessGraphRuntime.applyEvent({
      id: `evt_party_crm_${partyId}_${Date.now()}`,
      timestampISO: nowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
      source: String(source || "crm"),
      payload: {
        party: {
          id: partyId,
          partyType: "PERSON",
          displayName: String(contact.name || "Unnamed"),
          status: "active",
          contactMethods: [
            contact.email ? `email:${String(contact.email)}` : null,
            contact.phone ? `phone:${String(contact.phone)}` : null,
          ].filter(Boolean),
          externalReferences: [`crm:${partyId}`],
          metadata: {
            email: contact.email || null,
            phone: contact.phone || null,
            kind: contact.kind || "lead",
            tags: Array.isArray(contact.tags) ? contact.tags : [],
            crmContactId: partyId,
          },
          createdAt: contact.createdAt || nowISO,
          updatedAt: nowISO,
        },
      },
    });
    return { ok: true, created: true };
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (/already exists/i.test(msg)) return { ok: true, existed: true };
    return { ok: false, reason: msg };
  }
}

/**
 * Best-effort PIPELINE_CARD_CREATED + PIPELINE_STAGE_ENTERED emission for a
 * freshly created pipeline card. Non-fatal — callers (Meta ingest, forms
 * submit, public booking) must not fail the request if automations can't fire.
 * @returns {{ emitted: boolean, reason?: string }}
 */
async function emitPipelineCardCreatedEvents({ workspaceService, actorId, crm, cardId, pipelineId }) {
  if (!workspaceService?.emitSpecialtyBusinessEvent || !cardId) {
    return { emitted: false, reason: "workspace_unavailable" };
  }
  try {
    const { card, stage } = findCardAndStage(crm, cardId);
    const eventPayload = buildPipelineCardEventPayload({ pipelineId, card, stage });
    await workspaceService.emitSpecialtyBusinessEvent({
      eventType: "PIPELINE_CARD_CREATED",
      forceManual: false,
      brief: `New card "${card?.title || "Opportunity"}" added to pipeline`,
      actorId: actorId ?? "system",
      eventPayload,
    });
    // A freshly created card also enters its initial stage — let stage-based
    // automations (e.g. "When a card enters X") fire the same as on move_card.
    await workspaceService.emitSpecialtyBusinessEvent({
      eventType: "PIPELINE_STAGE_ENTERED",
      forceManual: false,
      brief: `Opportunity "${card?.title || "Opportunity"}" entered stage "${stage?.label ?? card?.stageId ?? ""}"`,
      actorId: actorId ?? "system",
      eventPayload,
    });
    return { emitted: true };
  } catch (err) {
    return { emitted: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Read → mutate → write CrmStore, then optional graph dual-write.
 * When `workspaceService` is provided and a *new* pipeline card was created
 * (not a reused/updated one), also emits PIPELINE_CARD_CREATED +
 * PIPELINE_STAGE_ENTERED so form/Meta/booking intake drives the same
 * automations as the manual pipelines UI.
 */
export async function ensureCrmContactPersisted({
  platformStore,
  installation,
  actorId = null,
  businessGraphRuntime = null,
  persistGraph = null,
  contact,
  addToPipeline = false,
  pipelineId = null,
  stageId = null,
  cardId = null,
  cardTitle = null,
  skipExistingCard = true,
  dualWriteSource = "crm",
  workspaceService = null,
  emitPipelineCardEvents = true,
} = {}) {
  if (!platformStore || !installation) {
    throw new Error("ensureCrmContactPersisted requires platformStore and installation");
  }
  const crm0 = readCrmState(installation);
  const ensured = ensureCrmContactAndOptionalCard(crm0, {
    contact,
    addToPipeline,
    pipelineId,
    stageId,
    cardId,
    cardTitle,
    skipExistingCard,
  });
  const crm = await writeCrmState({
    platformStore,
    installation,
    crm: ensured.crm,
    actorId,
  });

  const party = tryDualWriteParty({
    businessGraphRuntime,
    contact: ensured.contact,
    source: dualWriteSource,
  });
  if (party.created && typeof persistGraph === "function") {
    try {
      await persistGraph();
    } catch {
      /* optional */
    }
  }

  let pipelineCardEvent = null;
  if (emitPipelineCardEvents && ensured.cardCreated && ensured.cardId) {
    pipelineCardEvent = await emitPipelineCardCreatedEvents({
      workspaceService,
      actorId,
      crm,
      cardId: ensured.cardId,
      pipelineId: ensured.pipelineId,
    });
  }

  return {
    ...ensured,
    crm,
    party,
    pipelineCardEvent,
  };
}
