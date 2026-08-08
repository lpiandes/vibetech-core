/**
 * Request white-glove setup, email ops with hand-holding steps, mark ready.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  getWhiteGloveConnection,
  isWhiteGloveConnection,
  markReadyRequiresConnected as registryRequiresConnected,
  normalizeConnectionId,
  playbookIdForConnection,
} from "./WhiteGloveConnectionRegistry.js";
import {
  OPS_STATUS,
  buildPendingOpsRequest,
  isConnectionLiveStatus,
  markOpsRequestReady,
  readPendingOpsRequests,
  resolveBusinessConnectionStatuses,
  withOpsNotifyResult,
} from "./whiteGloveOpsState.js";
import { resolveWhiteGloveNeeds } from "./resolveWhiteGloveNeeds.js";
import {
  buildOpsPlaybook,
  playbookToOperatorAction,
} from "../../admin/opsPlaybooks/OpsPlaybookRegistry.js";
import {
  DEFAULT_PLATFORM_OPERATOR_EMAIL,
  notifyPlatformOperators,
} from "../../admin/notifyPlatformOperators.js";
import { readPurchasedPackagesFromConfig } from "../../platform/packages/SalesPackageCatalog.js";

async function persistPendingOps({
  platformStore,
  businessId,
  business,
  installation,
  connectionId,
  opsRequest,
  actorId = "system",
}) {
  const currentBiz = business?.packageConfiguration && typeof business.packageConfiguration === "object"
    ? business.packageConfiguration
    : {};
  const nextPending = {
    ...(currentBiz.pendingOpsRequests && typeof currentBiz.pendingOpsRequests === "object"
      ? currentBiz.pendingOpsRequests
      : {}),
    [connectionId]: opsRequest,
  };

  if (typeof platformStore.updateBusinessPackageConfiguration === "function") {
    await platformStore.updateBusinessPackageConfiguration({
      businessId,
      packageConfiguration: {
        ...currentBiz,
        pendingOpsRequests: nextPending,
      },
    });
  }

  if (installation && typeof platformStore.upsertBusinessOSInstallation === "function") {
    const fresh = await platformStore.getBusinessOSInstallation(businessId).catch(() => installation);
    if (fresh) {
      await platformStore.upsertBusinessOSInstallation({
        id: fresh.id ?? fresh.installationId ?? `install_${businessId}`,
        businessId,
        specificationRowId: fresh.specificationRowId ?? null,
        specificationId: fresh.specificationId ?? `spec_${businessId}`,
        specificationVersion: fresh.specificationVersion ?? 1,
        specificationContentHash: fresh.specificationContentHash ?? fresh.contentHash ?? "white_glove",
        planId: fresh.planId ?? `plan_${businessId}`,
        status: fresh.status ?? "installed",
        plan: fresh.plan ?? {},
        actionCheckpoints: Array.isArray(fresh.actionCheckpoints) ? fresh.actionCheckpoints : [],
        configuration: {
          ...(fresh.configuration ?? {}),
          pendingOpsRequests: {
            ...(fresh.configuration?.pendingOpsRequests ?? {}),
            [connectionId]: opsRequest,
          },
        },
        history: Array.isArray(fresh.history) ? fresh.history.slice(-50) : [],
        installedAt: fresh.installedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: actorId,
        actorUserId: actorId,
      });
    }
  }

  return nextPending;
}

function buildNotifyPayload(notifyResult) {
  if (!notifyResult || typeof notifyResult !== "object") {
    return { ok: false, error: "no_notify_result" };
  }
  return {
    ok: notifyResult.ok !== false && !notifyResult.error,
    skipped: Boolean(notifyResult.skipped),
    reason: notifyResult.reason ?? null,
    error: notifyResult.error ? String(notifyResult.error) : null,
  };
}

/**
 * Owner (or system) requests ops setup for one white-glove connection.
 */
export async function requestWhiteGloveSetup({
  platformStore,
  businessId,
  connectionId,
  ownerInputs = {},
  requestedBy = null,
  origin = "https://app.vtechdevelopment.com",
  needEverything = false,
  notify = true,
} = {}) {
  const id = normalizeConnectionId(connectionId) ?? String(connectionId ?? "").trim();
  if (!isWhiteGloveConnection(id)) {
    return deepFreeze({ ok: false, reason: "not_white_glove" });
  }

  const business = await platformStore.getBusinessById?.(businessId).catch(() => null);
  const installation = await platformStore.getBusinessOSInstallation?.(businessId).catch(() => null);
  const businessName = String(business?.name ?? businessId);
  const adminHref = `/admin/businesses/${encodeURIComponent(businessId)}`;
  const integrationsHref = `${origin}/b/${encodeURIComponent(businessId)}/integrations?focus=${encodeURIComponent(id)}`;
  const playbookId = playbookIdForConnection(id, { needEverything });
  const playbook = buildOpsPlaybook(playbookId, {
    origin,
    businessId,
    businessName,
    integrationsHref,
    adminHref,
    ownerCell: ownerInputs.cell ?? ownerInputs.forwardNumber ?? null,
    notes: ownerInputs.notes ?? null,
    pageName: ownerInputs.pageName ?? null,
    pageUrl: ownerInputs.pageUrl ?? null,
    webhookUrl: `${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/meta/webhook`,
    industry: business?.packageConfiguration?.industry ?? "",
    fromNumber: ownerInputs.fromNumber ?? null,
    a2pStatus: ownerInputs.a2pStatus ?? null,
  });

  let opsRequest = buildPendingOpsRequest({
    connectionId: id,
    playbookId: playbook.id,
    steps: playbook.steps,
    requestedBy,
    ownerInputs,
    integrationsHref,
    adminHref: `${origin}${adminHref}`,
  });

  let notifyResult = null;
  if (notify) {
    const action = playbookToOperatorAction(playbook, {
      businessId,
      businessName,
      href: adminHref,
      payload: opsRequest,
    });
    action.summary = [
      playbook.when,
      requestedBy ? `Requested by: ${requestedBy}` : null,
      ownerInputs.cell ? `Owner cell: ${ownerInputs.cell}` : null,
      ownerInputs.pageName ? `Page: ${ownerInputs.pageName}` : null,
      ownerInputs.pageUrl ? `Page URL: ${ownerInputs.pageUrl}` : null,
      ownerInputs.notes ? `Notes: ${ownerInputs.notes}` : null,
      "After credentials are Connected in Support access, click Mark ready on Admin → White-glove ops.",
    ].filter(Boolean).join("\n");

    notifyResult = await notifyPlatformOperators({
      actions: [action],
      force: true,
      fallbackDefaultEmail: true,
      toEmails: [DEFAULT_PLATFORM_OPERATOR_EMAIL],
      from: "VIBETech Support <support@vtechdevelopment.com>",
      replyTo: "support@vtechdevelopment.com",
    }).catch((err) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }));

    opsRequest = withOpsNotifyResult(opsRequest, buildNotifyPayload(notifyResult));
  }

  await persistPendingOps({
    platformStore,
    businessId,
    business,
    installation,
    connectionId: id,
    opsRequest,
    actorId: requestedBy || "owner",
  });

  return deepFreeze({
    ok: true,
    connectionId: id,
    opsRequest,
    notify: notifyResult,
    notifyOk: buildNotifyPayload(notifyResult).ok || !notify,
    ownerMessage: getWhiteGloveConnection(id)?.ownerPendingCopy
      ?? "Hold on — VIBETech is setting this up for you.",
  });
}

/**
 * Admin marks ready only when credentials are Connected.
 * Owner then sees Connected + Test (phase prefers live status).
 */
export async function markWhiteGloveReady({
  platformStore,
  businessId,
  connectionId,
  actorId = "admin",
  requireConnected = true,
  connectionStatuses = null,
} = {}) {
  const id = normalizeConnectionId(connectionId) ?? String(connectionId ?? "").trim();
  if (!isWhiteGloveConnection(id)) {
    return deepFreeze({ ok: false, reason: "not_white_glove" });
  }

  const business = await platformStore.getBusinessById?.(businessId).catch(() => null);
  const installation = await platformStore.getBusinessOSInstallation?.(businessId).catch(() => null);
  const statuses = connectionStatuses ?? await resolveBusinessConnectionStatuses({
    platformStore,
    businessId,
  });
  const live = isConnectionLiveStatus(statuses[id]);
  const mustBeConnected = requireConnected && registryRequiresConnected(id);

  if (mustBeConnected && !live) {
    return deepFreeze({
      ok: false,
      reason: "not_connected",
      message: "Connect credentials first (Support access → Integrations → advanced), then Mark ready.",
      connectionStatus: statuses[id] ?? "NOT_CONNECTED",
    });
  }

  const pending = readPendingOpsRequests(business?.packageConfiguration, installation);
  const existing = pending[id];
  const base = existing ?? buildPendingOpsRequest({
    connectionId: id,
    playbookId: playbookIdForConnection(id),
  });
  const ready = markOpsRequestReady(base, { actorId });
  await persistPendingOps({
    platformStore,
    businessId,
    business,
    installation,
    connectionId: id,
    opsRequest: ready,
    actorId,
  });
  return deepFreeze({ ok: true, opsRequest: ready, connectionStatus: statuses[id] ?? null });
}

/**
 * After credentials are saved: flip ops_ready without requiring a second admin click.
 */
export async function markWhiteGloveReadyFromCredentials({
  platformStore,
  businessId,
  connectionId,
  actorId = "credentials_connected",
} = {}) {
  return markWhiteGloveReady({
    platformStore,
    businessId,
    connectionId,
    actorId,
    requireConnected: false,
    connectionStatuses: { [normalizeConnectionId(connectionId) ?? connectionId]: "CONNECTED" },
  });
}

/**
 * First Home after install: email ops a digest of white-glove needs.
 * Does NOT create owner Pending rows — owner must Request setup (or you connect under Support).
 */
export async function notifyWhiteGloveHandoffForBusiness({
  platformStore,
  businessId,
  origin = "https://app.vtechdevelopment.com",
  force = false,
} = {}) {
  const business = await platformStore.getBusinessById?.(businessId).catch(() => null);
  const installation = await platformStore.getBusinessOSInstallation?.(businessId).catch(() => null);
  if (!installation) {
    return deepFreeze({ ok: false, reason: "no_installation" });
  }

  const cfg = {
    ...(business?.packageConfiguration ?? {}),
    ...(installation.configuration ?? {}),
  };
  if (!force && cfg.whiteGloveHandoffNotifiedAt) {
    return deepFreeze({ ok: true, skipped: true, reason: "already_notified" });
  }

  const packages = readPurchasedPackagesFromConfig(cfg);
  const needs = resolveWhiteGloveNeeds({
    purchasedPackages: packages,
    configuration: installation.configuration ?? cfg,
    includePackageAnyOf: true,
  });
  const statuses = await resolveBusinessConnectionStatuses({ platformStore, businessId });
  const pending = readPendingOpsRequests(business?.packageConfiguration, installation);
  const actions = [];

  for (const need of needs) {
    const id = need.connectionId;
    if (isConnectionLiveStatus(statuses[id])) continue;
    if (pending[id]?.status === OPS_STATUS.PENDING || pending[id]?.status === OPS_STATUS.READY) {
      // Already in owner UI — still include in digest once.
    }
    const adminHref = `/admin/businesses/${encodeURIComponent(businessId)}`;
    const integrationsHref = `${origin}/b/${encodeURIComponent(businessId)}/integrations?focus=${encodeURIComponent(id)}`;
    const playbook = buildOpsPlaybook(need.playbookId, {
      origin,
      businessId,
      businessName: String(business?.name ?? businessId),
      integrationsHref,
      adminHref,
    });
    actions.push(playbookToOperatorAction(playbook, {
      businessId,
      businessName: String(business?.name ?? businessId),
      href: adminHref,
      payload: {
        connectionId: id,
        source: "install_handoff",
        note: "Owner has not necessarily clicked Request setup yet — this is an ops heads-up.",
      },
    }));
  }

  if (!actions.length) {
    const at = new Date().toISOString();
    await stampHandoff(platformStore, businessId, business, {
      at,
      notify: { ok: true, skipped: true, reason: "no_white_glove_needs" },
    });
    return deepFreeze({ ok: true, skipped: true, reason: "no_white_glove_needs", notifiedAt: at });
  }

  const notify = await notifyPlatformOperators({
    actions,
    force: true,
    fallbackDefaultEmail: true,
    toEmails: [DEFAULT_PLATFORM_OPERATOR_EMAIL],
    from: "VIBETech Support <support@vtechdevelopment.com>",
    replyTo: "support@vtechdevelopment.com",
  }).catch((err) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }));

  const at = new Date().toISOString();
  await stampHandoff(platformStore, businessId, business, {
    at,
    notify: buildNotifyPayload(notify),
    actionCount: actions.length,
  });

  return deepFreeze({
    ok: true,
    actionCount: actions.length,
    notify,
    notifyOk: buildNotifyPayload(notify).ok,
    notifiedAt: at,
  });
}

/**
 * Re-send the ops email for one pending white-glove request (or install handoff digest).
 * Reusable for Admin "Retry notify" after delivery failures.
 */
export async function retryWhiteGloveNotify({
  platformStore,
  businessId,
  connectionId = null,
  origin = "https://app.vtechdevelopment.com",
  actorId = "admin",
} = {}) {
  const id = connectionId
    ? (normalizeConnectionId(connectionId) ?? String(connectionId).trim())
    : null;

  if (!id) {
    return notifyWhiteGloveHandoffForBusiness({
      platformStore,
      businessId,
      origin,
      force: true,
    });
  }

  if (!isWhiteGloveConnection(id)) {
    return deepFreeze({ ok: false, reason: "not_white_glove" });
  }

  const business = await platformStore.getBusinessById?.(businessId).catch(() => null);
  const installation = await platformStore.getBusinessOSInstallation?.(businessId).catch(() => null);
  const pending = readPendingOpsRequests(business?.packageConfiguration, installation);
  const existing = pending[id];
  const wg = getWhiteGloveConnection(id);
  const businessName = String(business?.name ?? businessId);
  const adminHref = `/admin/businesses/${encodeURIComponent(businessId)}`;
  const integrationsHref = existing?.integrationsHref
    ?? `${origin}/b/${encodeURIComponent(businessId)}/integrations?focus=${encodeURIComponent(id)}`;
  const playbookId = existing?.playbookId ?? playbookIdForConnection(id);
  const ownerInputs = existing?.ownerInputs && typeof existing.ownerInputs === "object"
    ? existing.ownerInputs
    : {};

  const playbook = buildOpsPlaybook(playbookId, {
    origin,
    businessId,
    businessName,
    integrationsHref,
    adminHref,
    ownerCell: ownerInputs.cell ?? ownerInputs.forwardNumber ?? null,
    notes: ownerInputs.notes ?? null,
    pageName: ownerInputs.pageName ?? null,
    pageUrl: ownerInputs.pageUrl ?? null,
    webhookUrl: `${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/meta/webhook`,
    industry: business?.packageConfiguration?.industry ?? "",
    fromNumber: ownerInputs.fromNumber ?? null,
    a2pStatus: ownerInputs.a2pStatus ?? null,
  });

  const action = playbookToOperatorAction(playbook, {
    businessId,
    businessName,
    href: adminHref,
    payload: { ...(existing ?? {}), connectionId: id, retry: true, actorId },
  });
  action.summary = [
    playbook.when,
    "RETRY — previous ops email may have failed.",
    ownerInputs.notes ? `Notes: ${ownerInputs.notes}` : null,
    `Owner title: ${wg?.ownerTitle ?? id}`,
  ].filter(Boolean).join("\n");

  const notifyResult = await notifyPlatformOperators({
    actions: [action],
    force: true,
    fallbackDefaultEmail: true,
    toEmails: [DEFAULT_PLATFORM_OPERATOR_EMAIL],
    from: "VIBETech Support <support@vtechdevelopment.com>",
    replyTo: "support@vtechdevelopment.com",
  }).catch((err) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }));

  const notifyPayload = buildNotifyPayload(notifyResult);
  if (existing) {
    const updated = withOpsNotifyResult(existing, notifyPayload);
    await persistPendingOps({
      platformStore,
      businessId,
      business,
      installation,
      connectionId: id,
      opsRequest: updated,
      actorId,
    });
  }

  return deepFreeze({
    ok: notifyPayload.ok,
    connectionId: id,
    notify: notifyResult,
    notifyOk: notifyPayload.ok,
  });
}

async function stampHandoff(platformStore, businessId, business, payload) {
  try {
    if (typeof platformStore.updateBusinessPackageConfiguration === "function") {
      const current = business?.packageConfiguration ?? {};
      await platformStore.updateBusinessPackageConfiguration({
        businessId,
        packageConfiguration: {
          ...current,
          whiteGloveHandoffNotifiedAt: payload.at,
          whiteGloveHandoffNotify: payload.notify ?? null,
          whiteGloveHandoffActionCount: payload.actionCount ?? 0,
        },
      });
    }
  } catch {
    /* best effort */
  }
}
