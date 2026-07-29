/**
 * Accept / reject prospecting candidates → CRM leads + optional pipeline cards.
 */
import {
  ensureCrmContactPersisted,
} from "../crm/ensureCrmContactAndOptionalCard.js";
import {
  getProspectingRun,
  normalizeCandidate,
  readProspectingState,
  upsertProspectingRun,
  writeProspectingState,
} from "./ProspectingJobStore.js";

function fieldValue(field) {
  if (field && typeof field === "object") return field.value ? String(field.value) : "";
  return field ? String(field) : "";
}

function buildProspectNotes(candidate, runId) {
  const lines = [
    `AI prospect (run ${runId})`,
    candidate.companyName ? `Company: ${candidate.companyName}` : null,
    candidate.website ? `Website: ${candidate.website}` : null,
    candidate.overview ? `Overview: ${candidate.overview}` : null,
    candidate.sizeEstimate
      ? `Size: ${candidate.sizeEstimate}${candidate.sizeEstimated ? " (estimated)" : ""}`
      : null,
    candidate.decisionMakerTitle ? `Title: ${candidate.decisionMakerTitle}` : null,
  ].filter(Boolean);

  const emailConf = candidate.email?.confidence;
  const phoneConf = candidate.phone?.confidence;
  if (candidate.email?.value) {
    lines.push(
      `Email: ${candidate.email.value} [${emailConf ?? "unknown"}${candidate.email.verified ? ", verified" : ", unverified"}] via ${candidate.email.source ?? "unknown"}`,
    );
  }
  if (candidate.phone?.value) {
    lines.push(
      `Phone: ${candidate.phone.value} [${phoneConf ?? "unknown"}${candidate.phone.verified ? ", verified" : ", unverified"}] via ${candidate.phone.source ?? "unknown"}`,
    );
  }
  if (Array.isArray(candidate.sources) && candidate.sources.length) {
    lines.push(`Sources: ${candidate.sources.join(" | ")}`);
  }
  return lines.join("\n");
}

/**
 * Accept selected candidates into CRM.
 * @returns {Promise<{ ok: boolean, accepted: object[], skipped: object[], run: object }>}
 */
export async function acceptProspectingCandidates({
  platformStore,
  installation,
  runId,
  candidateIds = null,
  pipelineId = null,
  stageId = null,
  addToPipeline = true,
  actorId = null,
  businessGraphRuntime = null,
  persistGraph = null,
  emitContactCreated = null,
} = {}) {
  let state = readProspectingState(installation);
  let run = getProspectingRun(state, runId);
  if (!run) throw new Error("Prospecting run not found");

  const want = candidateIds == null
    ? null
    : new Set((Array.isArray(candidateIds) ? candidateIds : [candidateIds]).map(String));

  const pipeId = pipelineId ?? run.criteria?.pipelineId ?? null;
  const stgId = stageId ?? run.criteria?.stageId ?? null;

  const accepted = [];
  const skipped = [];
  const nextCandidates = [];

  for (const cand of run.candidates ?? []) {
    const selected = !want || want.has(cand.id);
    if (!selected) {
      nextCandidates.push(cand);
      continue;
    }
    if (cand.status === "accepted" || cand.status === "rejected") {
      skipped.push({ id: cand.id, reason: cand.status });
      nextCandidates.push(cand);
      continue;
    }
    if (cand.status === "duplicate") {
      skipped.push({ id: cand.id, reason: "duplicate", contactId: cand.duplicateOfContactId });
      nextCandidates.push(cand);
      continue;
    }

    const name = String(cand.decisionMakerName || cand.companyName || "Prospect").trim();
    const tags = [
      "ai_prospect",
      `prospecting_run:${run.id}`,
      cand.companyName ? `company:${cand.companyName.slice(0, 40)}` : null,
    ].filter(Boolean);

    const result = await ensureCrmContactPersisted({
      platformStore,
      installation,
      actorId,
      businessGraphRuntime,
      persistGraph,
      contact: {
        name,
        email: fieldValue(cand.email),
        phone: fieldValue(cand.phone),
        kind: "lead",
        tags,
        notes: buildProspectNotes(cand, run.id),
      },
      addToPipeline: Boolean(addToPipeline),
      pipelineId: pipeId,
      stageId: stgId,
      cardTitle: cand.companyName || name,
      dualWriteSource: "ai_prospecting",
    });

    // Refresh installation pointer after CRM write
    installation = await platformStore.getBusinessOSInstallation(installation.businessId)
      ?? installation;

    const updated = normalizeCandidate({
      ...cand,
      status: "accepted",
      acceptedContactId: result.contact?.id ?? null,
      updatedAt: new Date().toISOString(),
    });
    nextCandidates.push(updated);
    accepted.push({
      candidateId: cand.id,
      contactId: result.contact?.id,
      cardId: result.cardId,
      created: result.created,
      contact: result.contact,
    });

    if (result.created && typeof emitContactCreated === "function") {
      try {
        await emitContactCreated({
          contact: result.contact,
          candidate: cand,
          runId: run.id,
        });
      } catch {
        /* optional */
      }
    }
  }

  // Re-read prospecting after CRM writes may have reloaded installation
  state = readProspectingState(installation);
  run = getProspectingRun(state, runId) ?? run;
  run = {
    ...run,
    candidates: nextCandidates,
    updatedAt: new Date().toISOString(),
  };
  state = upsertProspectingRun(state, run);
  await writeProspectingState({ platformStore, installation, prospectingState: state, actorId });

  return { ok: true, accepted, skipped, run };
}

/**
 * Reject / dismiss candidates.
 */
export async function rejectProspectingCandidates({
  platformStore,
  installation,
  runId,
  candidateIds = [],
  actorId = null,
} = {}) {
  let state = readProspectingState(installation);
  let run = getProspectingRun(state, runId);
  if (!run) throw new Error("Prospecting run not found");

  const want = new Set((Array.isArray(candidateIds) ? candidateIds : [candidateIds]).map(String));
  const nextCandidates = (run.candidates ?? []).map((cand) => {
    if (!want.has(cand.id)) return cand;
    if (cand.status === "accepted") return cand;
    return normalizeCandidate({
      ...cand,
      status: "rejected",
      updatedAt: new Date().toISOString(),
    });
  });

  run = {
    ...run,
    candidates: nextCandidates,
    updatedAt: new Date().toISOString(),
  };
  state = upsertProspectingRun(state, run);
  await writeProspectingState({ platformStore, installation, prospectingState: state, actorId });
  return { ok: true, run };
}
