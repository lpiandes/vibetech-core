import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export const PREFERENCE_STATUSES = ["opt_in", "opt_out", "suppressed"];

function fail(message) {
  throw new Error(`CommunicationPreference: ${message}`);
}

export function createCommunicationPreference({
  id,
  partyId,
  workspaceId,
  channel,
  scope = "all",
  status,
  source = "system",
  recordedAt,
  externalReference = null,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!partyId || typeof partyId !== "string") fail("partyId required.");
  if (!workspaceId || typeof workspaceId !== "string") fail("workspaceId required.");
  if (!channel || typeof channel !== "string") fail("channel required.");
  const st = String(status);
  if (!PREFERENCE_STATUSES.includes(st)) fail(`invalid status: ${st}`);
  if (!recordedAt || typeof recordedAt !== "string") fail("recordedAt required.");

  return deepFreeze({
    id: String(id),
    partyId: String(partyId),
    workspaceId: String(workspaceId),
    channel: String(channel),
    scope: String(scope),
    status: st,
    source: String(source),
    recordedAt: String(recordedAt),
    externalReference: externalReference ? String(externalReference) : null,
  });
}
