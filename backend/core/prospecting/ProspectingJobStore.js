/**
 * Persist prospecting jobs on installation.configuration.prospecting
 */
import crypto from "node:crypto";

import { normalizeProspectingCriteria } from "./ProspectingCriteria.js";

export const PROSPECTING_RUN_STATUSES = Object.freeze([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const CANDIDATE_STATUSES = Object.freeze([
  "pending",
  "accepted",
  "rejected",
  "duplicate",
]);

export function emptyProspectingState() {
  return {
    version: 1,
    runs: [],
    updatedAt: null,
  };
}

export function readProspectingState(installation = null) {
  const raw = installation?.configuration?.prospecting;
  if (!raw || typeof raw !== "object") return emptyProspectingState();
  return {
    version: 1,
    runs: Array.isArray(raw.runs) ? raw.runs.map(normalizeRun).filter(Boolean) : [],
    updatedAt: raw.updatedAt ?? null,
  };
}

export async function writeProspectingState({
  platformStore,
  installation,
  prospectingState,
  actorId = null,
}) {
  if (!platformStore || !installation) {
    throw new Error("writeProspectingState requires platformStore and installation");
  }
  const next = {
    version: 1,
    runs: (prospectingState.runs ?? []).map(normalizeRun).filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "prospecting_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...(installation.configuration && typeof installation.configuration === "object"
        ? installation.configuration
        : {}),
      prospecting: next,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history : []),
      { at: next.updatedAt, action: "prospecting_update", actorId },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });
  return next;
}

function normalizeFieldMeta(raw) {
  if (!raw || typeof raw !== "object") {
    return { value: null, confidence: "none", source: null, verified: false };
  }
  return {
    value: raw.value != null ? String(raw.value) : null,
    confidence: String(raw.confidence ?? "low"),
    source: raw.source != null ? String(raw.source) : null,
    verified: Boolean(raw.verified),
  };
}

export function normalizeCandidate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? "").trim() || `cand_${crypto.randomUUID().slice(0, 10)}`;
  return {
    id,
    status: CANDIDATE_STATUSES.includes(String(raw.status)) ? String(raw.status) : "pending",
    companyName: String(raw.companyName ?? "").trim(),
    website: String(raw.website ?? "").trim() || null,
    overview: String(raw.overview ?? "").trim() || null,
    industry: String(raw.industry ?? "").trim() || null,
    sizeEstimate: String(raw.sizeEstimate ?? "").trim() || null,
    sizeEstimated: raw.sizeEstimated !== false,
    decisionMakerName: String(raw.decisionMakerName ?? "").trim() || null,
    decisionMakerTitle: String(raw.decisionMakerTitle ?? "").trim() || null,
    email: normalizeFieldMeta(raw.email),
    phone: normalizeFieldMeta(raw.phone),
    sources: Array.isArray(raw.sources)
      ? raw.sources.map((s) => String(s ?? "").trim()).filter(Boolean).slice(0, 12)
      : [],
    duplicateOfContactId: raw.duplicateOfContactId
      ? String(raw.duplicateOfContactId)
      : null,
    enrichmentProvider: raw.enrichmentProvider ? String(raw.enrichmentProvider) : null,
    costMeta: raw.costMeta && typeof raw.costMeta === "object" ? raw.costMeta : null,
    acceptedContactId: raw.acceptedContactId ? String(raw.acceptedContactId) : null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

export function normalizeRun(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  const status = PROSPECTING_RUN_STATUSES.includes(String(raw.status))
    ? String(raw.status)
    : "queued";
  return {
    id,
    status,
    criteria: normalizeProspectingCriteria(raw.criteria ?? {}),
    candidates: Array.isArray(raw.candidates)
      ? raw.candidates.map(normalizeCandidate).filter(Boolean)
      : [],
    error: raw.error ? String(raw.error) : null,
    costMeta: raw.costMeta && typeof raw.costMeta === "object" ? raw.costMeta : null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    completedAt: raw.completedAt ?? null,
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
  };
}

export function createProspectingRun({ criteria, actorId = null, maxLeadsCap = null } = {}) {
  const normalized = normalizeProspectingCriteria(criteria);
  if (Number.isFinite(maxLeadsCap)) {
    normalized.maxLeads = Math.min(normalized.maxLeads, maxLeadsCap);
  }
  const now = new Date().toISOString();
  return {
    id: `prun_${crypto.randomUUID().slice(0, 12)}`,
    status: "queued",
    criteria: normalized,
    candidates: [],
    error: null,
    costMeta: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    createdBy: actorId,
  };
}

export function getProspectingRun(state, runId) {
  const id = String(runId ?? "").trim();
  return (state?.runs ?? []).find((r) => r.id === id) ?? null;
}

export function upsertProspectingRun(state, run) {
  const normalized = normalizeRun(run);
  if (!normalized) return state;
  const runs = Array.isArray(state?.runs) ? [...state.runs] : [];
  const idx = runs.findIndex((r) => r.id === normalized.id);
  if (idx >= 0) runs[idx] = normalized;
  else runs.unshift(normalized);
  // Keep last 40 runs
  return {
    version: 1,
    runs: runs.slice(0, 40),
    updatedAt: new Date().toISOString(),
  };
}

/** Count runs started on a UTC calendar day (for soft caps). */
export function countRunsOnDay(state, dayISO = new Date().toISOString().slice(0, 10)) {
  const day = String(dayISO).slice(0, 10);
  return (state?.runs ?? []).filter((r) => String(r.createdAt ?? "").slice(0, 10) === day).length;
}
