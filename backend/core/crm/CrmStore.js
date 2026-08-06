/**
 * Durable CRM state on Business OS installation.configuration.crm
 * — contacts kinds, pipelines/kanban, calendar event cache.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import crypto from "node:crypto";

export const CONTACT_KINDS = Object.freeze([
  "lead",
  "client",
  "family",
  "contractor",
  "vendor",
  "employee",
  "other",
]);

/** Reminder offsets for org calendar events (custom AI automation). */
export const CALENDAR_REMINDER_OFFSETS = Object.freeze(["24h", "1h", "10m"]);

/** Fixed palette for sales-rep ownership on pipeline cards. */
export const OWNER_COLOR_PALETTE = Object.freeze([
  { id: "blue", label: "Blue", hex: "#2563eb" },
  { id: "green", label: "Green", hex: "#16a34a" },
  { id: "amber", label: "Amber", hex: "#d97706" },
  { id: "rose", label: "Rose", hex: "#e11d48" },
  { id: "violet", label: "Violet", hex: "#7c3aed" },
  { id: "cyan", label: "Cyan", hex: "#0891b2" },
  { id: "orange", label: "Orange", hex: "#ea580c" },
  { id: "slate", label: "Slate", hex: "#475569" },
]);

export function emptyCrmState() {
  return {
    version: 1,
    contacts: [],
    pipelines: [defaultIntakePipeline()],
    calendarEvents: [],
    ownerColors: {},
    updatedAt: null,
  };
}

/**
 * Normalize owner color map: { [userId]: { colorId, hex, label } }
 */
export function normalizeOwnerColors(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const byId = Object.fromEntries(OWNER_COLOR_PALETTE.map((c) => [c.id, c]));
  const out = {};
  for (const [userId, value] of Object.entries(raw)) {
    const id = String(userId || "").trim();
    if (!id) continue;
    if (typeof value === "string") {
      const color = byId[value] || OWNER_COLOR_PALETTE.find((c) => c.hex === value);
      if (!color) continue;
      out[id] = { colorId: color.id, hex: color.hex, label: color.label };
      continue;
    }
    if (!value || typeof value !== "object") continue;
    const colorId = String(value.colorId ?? value.id ?? "").trim();
    const color = byId[colorId]
      || OWNER_COLOR_PALETTE.find((c) => c.hex === String(value.hex ?? "").trim());
    if (!color) continue;
    out[id] = {
      colorId: color.id,
      hex: color.hex,
      label: String(value.label ?? color.label).trim() || color.label,
    };
  }
  return out;
}

/**
 * @param {object} [crm]
 * @param {{ userId?: string, colorId?: string | null, label?: string | null }} [opts]
 */
export function setOwnerColor(crm, { userId, colorId, label = null } = {}) {
  const id = String(userId ?? "").trim();
  if (!id) return crm;
  const next = { ...(crm.ownerColors ?? {}) };
  if (!colorId) {
    delete next[id];
    return { ...crm, ownerColors: next };
  }
  const color = OWNER_COLOR_PALETTE.find((c) => c.id === String(colorId));
  if (!color) return crm;
  next[id] = {
    colorId: color.id,
    hex: color.hex,
    label: String(label ?? color.label).trim() || color.label,
  };
  return { ...crm, ownerColors: next };
}

export function defaultIntakePipeline() {
  return {
    id: "pipe_intake",
    name: "Intake",
    stages: [
      { id: "stage_new", label: "New", order: 0 },
      { id: "stage_contacted", label: "Contacted", order: 1 },
      { id: "stage_qualified", label: "Qualified", order: 2 },
      { id: "stage_won", label: "Won", order: 3 },
      { id: "stage_lost", label: "Lost", order: 4 },
    ],
    cards: [],
  };
}

export function readCrmState(installation = null) {
  const raw = installation?.configuration?.crm;
  if (!raw || typeof raw !== "object") return emptyCrmState();
  return {
    version: 1,
    contacts: Array.isArray(raw.contacts) ? raw.contacts : [],
    pipelines: Array.isArray(raw.pipelines) && raw.pipelines.length
      ? raw.pipelines
      : [defaultIntakePipeline()],
    calendarEvents: Array.isArray(raw.calendarEvents) ? raw.calendarEvents : [],
    ownerColors: normalizeOwnerColors(raw.ownerColors),
    updatedAt: raw.updatedAt ?? null,
  };
}

function asUuidOrNull(value) {
  const s = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return null;
  }
  return s;
}

export async function writeCrmState({ platformStore, installation, crm, actorId = null }) {
  if (!platformStore || !installation) {
    throw new Error("writeCrmState requires platformStore and installation");
  }
  const nextCrm = {
    ...crm,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  const priorHistory = Array.isArray(installation.history) ? installation.history : [];
  // Cap history — unbounded appends made CRM writes (prove seed) timeout on long-lived installs.
  const history = [
    ...priorHistory.slice(-49),
    {
      at: nextCrm.updatedAt,
      action: "crm_update",
      actorId,
    },
  ];
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId ?? `spec_${installation.businessId}`,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "crm_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
    configuration: {
      ...(installation.configuration ?? {}),
      crm: nextCrm,
    },
    history,
    // Postgres actor_user_id is UUID — never pass labels like "owner".
    actorUserId: asUuidOrNull(installation.actorUserId) ?? asUuidOrNull(actorId),
    installedAt: installation.installedAt ?? null,
  });
  return nextCrm;
}

export function removeContact(crm, { contactId } = {}) {
  const id = String(contactId ?? "").trim();
  if (!id) return crm;
  const contacts = (crm.contacts ?? []).filter(
    (c) => String(c.id) !== id && String(c.partyId) !== id,
  );
  const pipelines = (crm.pipelines ?? []).map((pipe) => ({
    ...pipe,
    cards: (pipe.cards ?? []).map((card) => (
      String(card.contactId ?? "") === id || String(card.partyId ?? "") === id
        ? { ...card, contactId: "", partyId: "" }
        : card
    )),
  }));
  return { ...crm, contacts, pipelines };
}

export function upsertContact(crm, contact) {
  const id = String(contact.id || contact.partyId || `contact_${crypto.randomUUID().slice(0, 8)}`);
  const next = {
    id,
    partyId: contact.partyId ?? id,
    name: String(contact.name ?? "").trim() || "Unnamed",
    email: String(contact.email ?? "").trim(),
    phone: String(contact.phone ?? "").trim(),
    kind: CONTACT_KINDS.includes(String(contact.kind)) ? String(contact.kind) : "lead",
    tags: Array.isArray(contact.tags) ? contact.tags.map(String) : [],
    notes: String(contact.notes ?? ""),
    ownerUserId: contact.ownerUserId ?? null,
    createdAt: contact.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const contacts = [...(crm.contacts ?? [])];
  const idx = contacts.findIndex((c) => String(c.id) === id || String(c.partyId) === id);
  if (idx >= 0) contacts[idx] = { ...contacts[idx], ...next, createdAt: contacts[idx].createdAt };
  else contacts.push(next);
  return { ...crm, contacts };
}

export function upsertCalendarEvent(crm, event) {
  const id = String(event.id || `evt_${crypto.randomUUID().slice(0, 10)}`);
  const next = {
    id,
    title: String(event.title ?? event.summary ?? "Event").trim(),
    description: String(event.description ?? ""),
    start: String(event.start ?? ""),
    end: String(event.end ?? ""),
    source: String(event.source ?? "vibetech"),
    externalId: event.externalId ?? null,
    htmlLink: event.htmlLink ?? null,
    visibility: String(event.visibility ?? "org"),
    createdBy: event.createdBy ?? null,
    /** Who can see org events: org members. Team overlays add free/busy separately. */
    audience: String(event.audience ?? "org_members"),
    conferenceType: event.conferenceType
      ? String(event.conferenceType)
      : null,
    conferenceUrl: event.conferenceUrl ? String(event.conferenceUrl).trim() : null,
    location: event.location ? String(event.location).trim() : "",
    reminderOffsets: Array.isArray(event.reminderOffsets)
      ? event.reminderOffsets.map(String)
      : [...CALENDAR_REMINDER_OFFSETS],
    remindersFired: Array.isArray(event.remindersFired)
      ? event.remindersFired.map(String)
      : [],
    updatedAt: new Date().toISOString(),
  };
  const calendarEvents = [...(crm.calendarEvents ?? [])];
  const idx = calendarEvents.findIndex((e) => String(e.id) === id || (e.externalId && e.externalId === next.externalId));
  if (idx >= 0) {
    calendarEvents[idx] = {
      ...calendarEvents[idx],
      ...next,
      remindersFired: Array.isArray(event.remindersFired)
        ? next.remindersFired
        : (calendarEvents[idx].remindersFired ?? []),
    };
  } else {
    calendarEvents.push(next);
  }
  return { ...crm, calendarEvents };
}

export function removeCalendarEvent(crm, { eventId } = {}) {
  const id = String(eventId ?? "").trim();
  if (!id) return crm;
  const calendarEvents = (crm.calendarEvents ?? []).filter(
    (e) => String(e.id) !== id && String(e.externalId ?? "") !== id,
  );
  return { ...crm, calendarEvents };
}

export function markCalendarReminderFired(crm, { eventId, offset }) {
  const calendarEvents = (crm.calendarEvents ?? []).map((e) => {
    if (String(e.id) !== String(eventId)) return e;
    const fired = Array.isArray(e.remindersFired) ? [...e.remindersFired] : [];
    const key = String(offset);
    if (!fired.includes(key)) fired.push(key);
    return { ...e, remindersFired: fired, updatedAt: new Date().toISOString() };
  });
  return { ...crm, calendarEvents };
}

export function movePipelineCard(crm, { pipelineId, cardId, stageId, index = null }) {
  const pipelines = (crm.pipelines ?? []).map((pipe) => {
    if (String(pipe.id) !== String(pipelineId)) return pipe;
    const cards = [...(pipe.cards ?? [])];
    const cardIdx = cards.findIndex((c) => String(c.id) === String(cardId));
    if (cardIdx < 0) return pipe;
    const [card] = cards.splice(cardIdx, 1);
    const moved = { ...card, stageId: String(stageId), updatedAt: new Date().toISOString() };
    if (index == null || index < 0 || index >= cards.length) {
      cards.push(moved);
    } else {
      cards.splice(index, 0, moved);
    }
    return { ...pipe, cards };
  });
  return { ...crm, pipelines };
}

export function upsertPipelineCard(crm, { pipelineId, card }) {
  let cardId = null;
  const pipelines = (crm.pipelines ?? []).map((pipe) => {
    if (String(pipe.id) !== String(pipelineId)) return pipe;
    const id = String(card.id || `card_${crypto.randomUUID().slice(0, 8)}`);
    cardId = id;
    const existing = (pipe.cards ?? []).find((c) => String(c.id) === id) ?? null;
    const ownerProvided = Object.prototype.hasOwnProperty.call(card, "ownerUserId");
    const next = {
      id,
      contactId: String(card.contactId ?? existing?.contactId ?? ""),
      partyId: card.partyId ?? card.contactId ?? existing?.partyId ?? existing?.contactId ?? null,
      title: card.title == null
        ? (existing?.title ?? "Opportunity")
        : String(card.title),
      stageId: String(card.stageId ?? existing?.stageId ?? pipe.stages?.[0]?.id ?? "stage_new"),
      value: Number(card.value != null ? card.value : existing?.value) || 0,
      ownerUserId: ownerProvided
        ? (card.ownerUserId ? String(card.ownerUserId) : null)
        : (existing?.ownerUserId ?? null),
      expectedClose: Object.prototype.hasOwnProperty.call(card, "expectedClose")
        ? (card.expectedClose ?? null)
        : (existing?.expectedClose ?? null),
      // Preserve RFT / evidence metadata (Revenue Follow-Through runtime).
      rft: Object.prototype.hasOwnProperty.call(card, "rft")
        ? card.rft
        : (existing?.rft ?? undefined),
      metadata: Object.prototype.hasOwnProperty.call(card, "metadata")
        ? card.metadata
        : (existing?.metadata ?? undefined),
      updatedAt: new Date().toISOString(),
      createdAt: card.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    };
    if (next.rft === undefined) delete next.rft;
    if (next.metadata === undefined) delete next.metadata;
    const cards = [...(pipe.cards ?? [])];
    const idx = cards.findIndex((c) => String(c.id) === id);
    if (idx >= 0) cards[idx] = { ...cards[idx], ...next, createdAt: cards[idx].createdAt };
    else cards.push(next);
    return { ...pipe, cards };
  });
  return {
    crm: { ...crm, pipelines },
    cardId,
  };
}

export function removePipelineCard(crm, { pipelineId, cardId }) {
  const pipelines = (crm.pipelines ?? []).map((pipe) => {
    if (String(pipe.id) !== String(pipelineId)) return pipe;
    return {
      ...pipe,
      cards: (pipe.cards ?? []).filter((c) => String(c.id) !== String(cardId)),
    };
  });
  return { ...crm, pipelines };
}

export function createPipeline(crm, { name, stages = null } = {}) {
  const id = `pipe_${crypto.randomUUID().slice(0, 8)}`;
  // New boards start blank unless the caller passes stages. Default Intake
  // stages are only for the seeded first pipeline.
  const nextStages = Array.isArray(stages)
    ? stages.map((s, i) => ({
      id: String(s.id || `stage_${crypto.randomUUID().slice(0, 8)}`),
      label: String(s.label ?? `Stage ${i + 1}`).trim() || `Stage ${i + 1}`,
      order: Number.isFinite(Number(s.order)) ? Number(s.order) : i,
    }))
    : [];
  const pipeline = {
    id,
    name: String(name ?? "New pipeline").trim() || "New pipeline",
    stages: nextStages,
    cards: [],
  };
  return {
    crm: { ...crm, pipelines: [...(crm.pipelines ?? []), pipeline] },
    pipelineId: id,
  };
}

export function renamePipeline(crm, { pipelineId, name }) {
  const nextName = String(name ?? "").trim();
  if (!nextName) return crm;
  const pipelines = (crm.pipelines ?? []).map((pipe) => {
    if (String(pipe.id) !== String(pipelineId)) return pipe;
    return { ...pipe, name: nextName };
  });
  return { ...crm, pipelines };
}

export function deletePipeline(crm, { pipelineId }) {
  const pipelines = crm.pipelines ?? [];
  if (pipelines.length <= 1) return crm;
  return {
    ...crm,
    pipelines: pipelines.filter((pipe) => String(pipe.id) !== String(pipelineId)),
  };
}

export function renamePipelineStage(crm, { pipelineId, stageId, label }) {
  const nextLabel = String(label ?? "").trim();
  if (!nextLabel) return crm;
  const pipelines = (crm.pipelines ?? []).map((pipe) => {
    if (String(pipe.id) !== String(pipelineId)) return pipe;
    return {
      ...pipe,
      stages: (pipe.stages ?? []).map((stage) => (
        String(stage.id) === String(stageId) ? { ...stage, label: nextLabel } : stage
      )),
    };
  });
  return { ...crm, pipelines };
}

export function addPipelineStage(crm, { pipelineId, label = "", afterStageId = null } = {}) {
  let createdStageId = null;
  const pipelines = (crm.pipelines ?? []).map((pipe) => {
    if (String(pipe.id) !== String(pipelineId)) return pipe;
    const stages = [...(pipe.stages ?? [])].sort((a, b) => a.order - b.order);
    const newStage = {
      id: `stage_${crypto.randomUUID().slice(0, 8)}`,
      label: String(label ?? "").trim(),
      order: stages.length,
    };
    createdStageId = newStage.id;
    let next = stages;
    if (afterStageId) {
      const idx = stages.findIndex((s) => String(s.id) === String(afterStageId));
      if (idx >= 0) {
        next = [...stages.slice(0, idx + 1), newStage, ...stages.slice(idx + 1)];
      } else {
        next = [...stages, newStage];
      }
    } else {
      next = [...stages, newStage];
    }
    return {
      ...pipe,
      stages: next.map((s, i) => ({ ...s, order: i })),
    };
  });
  return {
    crm: { ...crm, pipelines },
    stageId: createdStageId,
  };
}

export function reorderPipelineStages(crm, { pipelineId, stageId, toIndex }) {
  const pipelines = (crm.pipelines ?? []).map((pipe) => {
    if (String(pipe.id) !== String(pipelineId)) return pipe;
    const stages = [...(pipe.stages ?? [])].sort((a, b) => a.order - b.order);
    const from = stages.findIndex((s) => String(s.id) === String(stageId));
    if (from < 0) return pipe;
    const [moved] = stages.splice(from, 1);
    const idx = Math.max(0, Math.min(Number(toIndex), stages.length));
    stages.splice(idx, 0, moved);
    return {
      ...pipe,
      stages: stages.map((s, i) => ({ ...s, order: i })),
    };
  });
  return { ...crm, pipelines };
}

export function removePipelineStage(crm, { pipelineId, stageId }) {
  const pipelines = (crm.pipelines ?? []).map((pipe) => {
    if (String(pipe.id) !== String(pipelineId)) return pipe;
    const stages = [...(pipe.stages ?? [])].sort((a, b) => a.order - b.order);
    if (stages.length <= 1) return pipe;
    const remaining = stages.filter((s) => String(s.id) !== String(stageId));
    if (remaining.length === stages.length) return pipe;
    const fallbackId = remaining[0].id;
    const cards = (pipe.cards ?? []).map((card) => (
      String(card.stageId) === String(stageId)
        ? { ...card, stageId: fallbackId, updatedAt: new Date().toISOString() }
        : card
    ));
    return {
      ...pipe,
      stages: remaining.map((s, i) => ({ ...s, order: i })),
      cards,
    };
  });
  return { ...crm, pipelines };
}

export function isTerminalPipelineStage(stage) {
  const key = `${stage?.id ?? ""} ${stage?.label ?? ""}`.toLowerCase();
  return /\bwon\b/.test(key) || /\blost\b/.test(key);
}

export function buildCrmReportingStrip(crm = emptyCrmState(), extras = {}) {
  const contacts = crm.contacts ?? [];
  const pipelines = crm.pipelines ?? [];
  const cards = pipelines.flatMap((p) => p.cards ?? []);
  const upcoming = (crm.calendarEvents ?? [])
    .filter((e) => e.start && String(e.start) >= String(extras.nowISO ?? new Date().toISOString()))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return deepFreeze({
    contactCount: contacts.length,
    leadCount: contacts.filter((c) => c.kind === "lead").length,
    openOpportunities: cards.filter((c) => {
      const stage = pipelines
        .flatMap((p) => (p.stages ?? []).map((s) => ({ ...s, pipeId: p.id, cards: p.cards })))
        .find((s) => String(s.id) === String(c.stageId));
      return !isTerminalPipelineStage(stage ?? { id: c.stageId, label: "" });
    }).length,
    upcomingEvents: upcoming.length,
    nextEvent: upcoming[0] ?? null,
    pendingApprovals: Number(extras.pendingApprovals ?? 0),
    aiDraftsPending: Number(extras.aiDraftsPending ?? 0),
  });
}
