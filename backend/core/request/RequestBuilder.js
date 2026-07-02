import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createRequest } from "./Request.js";
import { computeRequestMetrics } from "./RequestMetrics.js";

export function buildDefaultRequestSeed({ nowISO } = {}) {
  const requests = [];
  const metrics = computeRequestMetrics({
    requests,
    nowISO: String(nowISO ?? "2026-07-01T00:00:00.000Z"),
  });

  return deepFreeze({
    requests,
    metrics,
  });
}

export function buildRequestForSeed({ nowISO, overrides } = {}) {
  const receivedAt = overrides?.receivedAt ?? nowISO ?? "2026-07-01T00:00:00.000Z";

  return createRequest({
    id: String(overrides?.id ?? "req_seed"),
    title: String(overrides?.title ?? "Seed Request"),
    description: String(overrides?.description ?? "Deterministic seed request."),
    requestType: String(overrides?.requestType ?? "generic"),
    status: String(overrides?.status ?? "received"),
    priority: String(overrides?.priority ?? "medium"),
    channel: String(overrides?.channel ?? "website"),
    source: String(overrides?.source ?? "manual"),
    requester: String(overrides?.requester ?? "owner"),
    receivedAt: String(receivedAt),
    dueAt: overrides?.dueAt ?? null,
    assignedWorkId: overrides?.assignedWorkId ?? null,
    assignedTeamMemberId: overrides?.assignedTeamMemberId ?? null,
    qualificationStatus: overrides?.qualificationStatus ?? null,
    attachments: Array.isArray(overrides?.attachments) ? overrides.attachments : [],
    metadata: overrides?.metadata && typeof overrides.metadata === "object" ? overrides.metadata : {},
  });
}

