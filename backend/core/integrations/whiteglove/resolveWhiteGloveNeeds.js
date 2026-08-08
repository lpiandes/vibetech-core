/**
 * Resolve which white-glove connections a business needs.
 * Sources: purchased packages, OS/custom-build config, explicit integrationNeeds.
 * No hardcoding of package IDs outside WhiteGloveConnectionRegistry maps.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  getWhiteGloveConnection,
  isWhiteGloveConnection,
  normalizeConnectionId,
  resolvePackageWhiteGloveSpec,
} from "./WhiteGloveConnectionRegistry.js";

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function pushNormalized(target, raw) {
  const id = normalizeConnectionId(raw);
  if (id && isWhiteGloveConnection(id)) target.add(id);
}

/**
 * Walk OS / builder configuration for channel mentions.
 */
export function inferWhiteGloveIdsFromConfiguration(configuration = {}) {
  const ids = new Set();
  const cfg = configuration && typeof configuration === "object" ? configuration : {};

  const candidates = [
    ...asArray(cfg.integrationNeeds),
    ...asArray(cfg.requiredConnections),
    ...asArray(cfg.requiredIntegrations),
    ...asArray(cfg.builderInputs?.integrations),
    ...asArray(cfg.businessSummary?.integrationNeeds),
    ...asArray(cfg.provenance?.integrationNeeds),
  ];

  for (const entry of candidates) {
    if (entry && typeof entry === "object") {
      pushNormalized(ids, entry.id ?? entry.connectionId ?? entry.integrationId ?? entry.type);
    } else {
      pushNormalized(ids, entry);
    }
  }

  for (const employee of asArray(cfg.employees)) {
    for (const channel of asArray(employee?.channels ?? employee?.requiredChannels)) {
      pushNormalized(ids, channel);
    }
    for (const capability of asArray(employee?.capabilities)) {
      const text = String(capability?.id ?? capability ?? "").toLowerCase();
      if (/voice|phone|call/.test(text)) pushNormalized(ids, "voice_channel");
      if (/sms|text/.test(text)) pushNormalized(ids, "sms_channel");
      if (/meta|facebook|lead.?ad/.test(text)) pushNormalized(ids, "meta_lead_ads");
      if (/hubspot/.test(text)) pushNormalized(ids, "hubspot");
      if (/highlevel|gohighlevel/.test(text)) pushNormalized(ids, "highlevel");
      if (/salesforce|sfdc/.test(text)) pushNormalized(ids, "salesforce");
    }
  }

  for (const module of asArray(cfg.modules)) {
    for (const conn of asArray(module?.requiredConnections ?? module?.integrations)) {
      pushNormalized(ids, conn?.id ?? conn);
    }
  }

  // Free-text communications / scheduling answers from AI Builder.
  const blob = [
    cfg.builderInputs?.communications,
    cfg.builderInputs?.scheduling,
    cfg.builderInputs?.services,
    cfg.builderInputs?.integrations,
    cfg.builderInputs?.software,
  ].filter(Boolean).map(String).join(" ").toLowerCase();
  if (blob) {
    if (/\b(phone|voice|call|receptionist|missed.?call)\b/.test(blob)) pushNormalized(ids, "voice_channel");
    if (/\b(sms|text message|texting)\b/.test(blob)) pushNormalized(ids, "sms_channel");
    if (/\b(meta|facebook|lead form|lead ad)\b/.test(blob)) pushNormalized(ids, "meta_lead_ads");
    if (/\bhubspot\b/.test(blob)) pushNormalized(ids, "hubspot");
    if (/\b(highlevel|go high level|gohighlevel)\b/.test(blob)) pushNormalized(ids, "highlevel");
    if (/\b(salesforce|sfdc)\b/.test(blob)) pushNormalized(ids, "salesforce");
  }

  return deepFreeze([...ids]);
}

/**
 * @param {{
 *   purchasedPackages?: string[],
 *   configuration?: object|null,
 *   includePackageAnyOf?: boolean,
 * }} input
 * @returns {Array<ReturnType<typeof getWhiteGloveConnection>>}
 */
export function resolveWhiteGloveNeeds({
  purchasedPackages = [],
  configuration = null,
  includePackageAnyOf = true,
} = {}) {
  const ids = new Set();

  for (const pkg of asArray(purchasedPackages).map(String).filter(Boolean)) {
    const spec = resolvePackageWhiteGloveSpec(pkg);
    for (const id of spec.all ?? []) ids.add(id);
    if (includePackageAnyOf) {
      for (const id of spec.anyOf ?? []) ids.add(id);
    }
  }

  for (const id of inferWhiteGloveIdsFromConfiguration(configuration)) {
    ids.add(id);
  }

  return deepFreeze(
    [...ids]
      .map((id) => getWhiteGloveConnection(id))
      .filter(Boolean),
  );
}

/**
 * For checklist completion: package anyOf means one connected channel is enough.
 */
export function packageConnectSatisfied({
  packageId,
  connectionStatuses = {},
  isConnected = (status) => {
    const s = String(status ?? "").toUpperCase();
    return s === "CONNECTED" || s === "VERIFIED" || s === "PROVEN" || s === "OK";
  },
} = {}) {
  const spec = resolvePackageWhiteGloveSpec(packageId);
  const required = spec.all ?? [];
  const anyOf = spec.anyOf ?? [];
  const requiredOk = required.every((id) => isConnected(connectionStatuses[id]));
  const anyOk = !anyOf.length || anyOf.some((id) => isConnected(connectionStatuses[id]));
  return requiredOk && anyOk;
}
