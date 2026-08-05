import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import {
  movePipelineCard,
  readCrmState,
  upsertContact,
  upsertPipelineCard,
  writeCrmState,
} from "../../../crm/CrmStore.js";
import {
  RFT_PIPELINE_ID,
  RFT_SCHEMA_ID,
  defaultRftPipelineStages,
  stageIdForRftState,
} from "./rftCatalog.js";
import { normalizeRftServiceStandard } from "./rftContract.js";
import {
  applyRftTransition,
  initialRftOpportunityState,
} from "./rftStateMachine.js";

/**
 * RFT opportunity runtime on existing CRM pipeline cards (no parallel store).
 */

function findRftEmployee(installation = null) {
  const employees = Array.isArray(installation?.configuration?.employees)
    ? installation.configuration.employees
    : [];
  return employees.find((emp) => {
    const schemaId = String(emp?.operatingContract?.schemaId ?? "");
    const label = String(emp?.label ?? emp?.displayName ?? "");
    return schemaId === RFT_SCHEMA_ID
      || /revenue\s*follow/i.test(label)
      || String(emp?.employeeId ?? emp?.id ?? "").includes("revenue_follow");
  }) ?? null;
}

function resolveContractMeta(installation = null, contractOverride = null) {
  if (contractOverride?.rft) {
    const rft = normalizeRftServiceStandard(contractOverride.rft);
    return { contractVersion: rft.contractVersion, contentHash: rft.contentHash, rft };
  }
  const employee = findRftEmployee(installation);
  const rft = normalizeRftServiceStandard(employee?.operatingContract?.rft ?? null);
  return { contractVersion: rft.contractVersion, contentHash: rft.contentHash, rft, employee };
}

export function ensureRftPipeline(crm) {
  const stages = defaultRftPipelineStages().map((s) => ({
    id: s.id,
    label: s.label,
    order: s.order,
  }));
  const existing = (crm.pipelines ?? []).find((p) => String(p.id) === RFT_PIPELINE_ID);
  if (existing) {
    const pipelines = (crm.pipelines ?? []).map((p) => (
      String(p.id) === RFT_PIPELINE_ID
        ? { ...p, name: p.name || "Revenue Follow-Through", stages }
        : p
    ));
    return { ...crm, pipelines };
  }
  return {
    ...crm,
    pipelines: [
      ...(crm.pipelines ?? []),
      {
        id: RFT_PIPELINE_ID,
        name: "Revenue Follow-Through",
        stages,
        cards: [],
      },
    ],
  };
}

function findCard(crm, cardId) {
  for (const pipe of crm.pipelines ?? []) {
    const card = (pipe.cards ?? []).find((c) => String(c.id) === String(cardId));
    if (card) return { pipelineId: pipe.id, card, pipeline: pipe };
  }
  return null;
}

/**
 * Seed a test / inbound opportunity in Detected with contract version metadata.
 */
export async function seedRftOpportunity({
  platformStore,
  installation,
  contact = {},
  title = null,
  triggerEvent = "WEBSITE_INQUIRY",
  actorId = null,
  evidence = [],
  contractOverride = null,
} = {}) {
  if (!platformStore || !installation) {
    throw new Error("seedRftOpportunity requires platformStore and installation");
  }
  const meta = resolveContractMeta(installation, contractOverride);
  let crm = ensureRftPipeline(readCrmState(installation));
  const contactId = String(
    contact.id || contact.partyId || `contact_${crypto.randomUUID().slice(0, 8)}`,
  );
  crm = upsertContact(crm, {
    id: contactId,
    name: contact.name ?? "Test prospect",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    source: contact.source ?? "rft_seed",
  });

  let rftState = initialRftOpportunityState({
    contractVersion: meta.contractVersion,
    contentHash: meta.contentHash,
    triggerEvent,
  });
  if (Array.isArray(evidence) && evidence.length) {
    const transition = applyRftTransition({
      fromState: "Detected",
      toState: "Detected",
      eventType: triggerEvent,
      evidence,
      actorId: actorId ?? "system",
    });
    if (transition.ok && transition.evidence.length) {
      rftState = deepFreeze({
        ...rftState,
        evidence: transition.evidence,
      });
    }
  }

  const { crm: withCard, cardId } = upsertPipelineCard(crm, {
    pipelineId: RFT_PIPELINE_ID,
    card: {
      title: title ?? `Opportunity — ${contact.name ?? "prospect"}`,
      contactId,
      stageId: stageIdForRftState("Detected"),
      value: Number(contact.value) || 0,
      rft: rftState,
    },
  });

  await writeCrmState({
    platformStore,
    installation,
    crm: withCard,
    actorId,
  });

  const refreshed = await platformStore.getBusinessOSInstallation(installation.businessId);
  const located = findCard(readCrmState(refreshed), cardId);

  return deepFreeze({
    ok: true,
    cardId,
    pipelineId: RFT_PIPELINE_ID,
    contactId,
    state: "Detected",
    contractVersion: meta.contractVersion,
    contentHash: meta.contentHash,
    card: located?.card ?? null,
  });
}

/**
 * Progress an opportunity through the RFT state machine with evidence.
 * Refuses Verified without provider-backed proof.
 */
export async function progressRftOpportunity({
  platformStore,
  installation,
  cardId,
  toState = null,
  eventType = null,
  evidence = [],
  outcomeType = null,
  actorId = null,
  note = null,
  contractOverride = null,
} = {}) {
  if (!platformStore || !installation) {
    throw new Error("progressRftOpportunity requires platformStore and installation");
  }
  const id = String(cardId ?? "").trim();
  if (!id) {
    return deepFreeze({ ok: false, code: "missing_card_id", message: "cardId required" });
  }

  const meta = resolveContractMeta(installation, contractOverride);
  let crm = ensureRftPipeline(readCrmState(installation));
  const located = findCard(crm, id);
  if (!located) {
    return deepFreeze({ ok: false, code: "card_not_found", message: `Opportunity card not found: ${id}` });
  }

  const priorRft = located.card.rft && typeof located.card.rft === "object"
    ? located.card.rft
    : initialRftOpportunityState({
      contractVersion: meta.contractVersion,
      contentHash: meta.contentHash,
    });

  const mergedEvidence = [
    ...(Array.isArray(priorRft.evidence) ? priorRft.evidence : []),
    ...(Array.isArray(evidence) ? evidence : []),
  ];

  const transition = applyRftTransition({
    fromState: priorRft.state ?? "Detected",
    toState,
    eventType,
    evidence: mergedEvidence,
    actorId,
    note,
  });

  if (!transition.ok) {
    return deepFreeze({
      ok: false,
      code: transition.code,
      message: transition.message,
      fromState: transition.fromState,
      toState: transition.toState,
      allowed: transition.allowed ?? null,
      contractVersion: meta.contractVersion,
      contentHash: meta.contentHash,
    });
  }

  const nextRft = {
    ...priorRft,
    state: transition.toState,
    contractVersion: meta.contractVersion,
    contentHash: meta.contentHash,
    evidence: transition.evidence,
    history: [
      ...(Array.isArray(priorRft.history) ? priorRft.history : []),
      transition.transition,
    ],
    outcomeType: outcomeType
      ? String(outcomeType)
      : (priorRft.outcomeType ?? null),
    lastTransitionAt: transition.at,
  };

  if (transition.toState === "OutcomeRecorded" && !nextRft.outcomeType) {
    nextRft.outcomeType = "HumanInterventionRequired";
  }

  let nextCrm = movePipelineCard(crm, {
    pipelineId: located.pipelineId,
    cardId: id,
    stageId: stageIdForRftState(transition.toState),
  });
  const { crm: withRft } = upsertPipelineCard(nextCrm, {
    pipelineId: located.pipelineId === RFT_PIPELINE_ID ? RFT_PIPELINE_ID : located.pipelineId,
    card: {
      ...located.card,
      id,
      stageId: stageIdForRftState(transition.toState),
      rft: nextRft,
    },
  });

  await writeCrmState({
    platformStore,
    installation,
    crm: withRft,
    actorId,
  });

  const refreshed = await platformStore.getBusinessOSInstallation(installation.businessId);
  const after = findCard(readCrmState(refreshed), id);

  return deepFreeze({
    ok: true,
    cardId: id,
    fromState: transition.fromState,
    toState: transition.toState,
    evidence: transition.evidence,
    contractVersion: meta.contractVersion,
    contentHash: meta.contentHash,
    outcomeType: nextRft.outcomeType,
    card: after?.card ?? null,
  });
}

export function getRftOpportunityTrace(installation, cardId) {
  const located = findCard(readCrmState(installation), cardId);
  if (!located?.card?.rft) return null;
  return deepFreeze({
    cardId: located.card.id,
    pipelineId: located.pipelineId,
    title: located.card.title,
    rft: located.card.rft,
    contactId: located.card.contactId ?? null,
  });
}
