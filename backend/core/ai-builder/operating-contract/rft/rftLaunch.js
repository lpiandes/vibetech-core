/**
 * Revenue Follow-Through launch progress on installation.configuration.rftLaunch.
 * Seven-step outcome launch — observe/replay/shadow unlock via Plans 6–7 artifacts.
 */
import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import { readRftObservation } from "./rftObservation.js";
import { readRftReplay } from "./rftReplay.js";

export const RFT_LAUNCH_STEPS = Object.freeze([
  "connect",
  "observe",
  "confirm",
  "replay",
  "shadow",
  "prove",
  "goLive",
]);

export const RFT_LAUNCH_STEP_STATUS = Object.freeze({
  pending: "pending",
  ready: "ready",
  complete: "complete",
  blocked: "blocked",
});

/**
 * Channels the connect step requires. Connection Center must list these whenever
 * the Today launch path is active — otherwise owners cannot finish step 1.
 */
export const RFT_CONNECT_CONNECTION_IDS = Object.freeze(["business_email", "calendar"]);

const RFT_CONNECT_LABELS = Object.freeze({
  business_email: "Business email",
  calendar: "Calendar",
});

/**
 * Match OperatingHomeExperience: RFT launch until go-live.
 * When active, Connections must surface every RFT_CONNECT_CONNECTION_IDS row.
 */
export function rftConnectRequirementsActive(installation = null) {
  return !installation?.configuration?.rftLaunch?.goLiveAt;
}

export function connectionRequirementsFromRftConnect(installation = null) {
  if (!rftConnectRequirementsActive(installation)) return [];
  return RFT_CONNECT_CONNECTION_IDS.map((id) => ({
    id,
    displayName: RFT_CONNECT_LABELS[id] ?? id.replace(/_/g, " "),
    requirementLevel: "required",
  }));
}

function emptySteps() {
  return {
    connect: { status: "pending", at: null, detail: null },
    observe: { status: "pending", at: null, detail: null },
    confirm: { status: "pending", at: null, detail: null },
    replay: { status: "pending", at: null, detail: null },
    shadow: { status: "pending", at: null, detail: null },
    prove: { status: "pending", at: null, detail: null },
    goLive: { status: "pending", at: null, detail: null },
  };
}

export function readRftLaunch(installation = null) {
  const raw = installation?.configuration?.rftLaunch;
  const steps = emptySteps();
  if (raw?.steps && typeof raw.steps === "object") {
    for (const key of RFT_LAUNCH_STEPS) {
      const prior = raw.steps[key];
      if (!prior || typeof prior !== "object") continue;
      steps[key] = {
        status: ["pending", "ready", "complete", "blocked"].includes(String(prior.status))
          ? String(prior.status)
          : "pending",
        at: prior.at ?? null,
        detail: prior.detail ?? null,
        reason: prior.reason ?? null,
      };
    }
  }
  return {
    version: 1,
    steps,
    confirmedContentHash: raw?.confirmedContentHash ? String(raw.confirmedContentHash) : null,
    confirmedContractVersion: raw?.confirmedContractVersion
      ? String(raw.confirmedContractVersion)
      : null,
    proveCardId: raw?.proveCardId ? String(raw.proveCardId) : null,
    goLiveAt: raw?.goLiveAt ? String(raw.goLiveAt) : null,
    observeCompletedAt: raw?.observeCompletedAt ?? null,
    replayPassedAt: raw?.replayPassedAt ?? null,
    shadowPassedAt: raw?.shadowPassedAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
  };
}

/**
 * Derive step statuses from live connection + proof + observation/replay/shadow state.
 */
export function evaluateRftLaunch({
  installation = null,
  connectionStatuses = {},
  proofRecords = {},
} = {}) {
  const launch = readRftLaunch(installation);
  const observation = readRftObservation(installation);
  const replayState = readRftReplay(installation);

  const emailConnected = isConnected(connectionStatuses, ["business_email", "gmail"]);
  const calendarConnected = isConnected(connectionStatuses, ["calendar", "google_calendar"]);
  const emailProven = isProven(proofRecords, ["customer_email_send"]);
  const calendarProven = isProven(proofRecords, ["calendar_scheduling"]);
  const formsProven = isProven(proofRecords, ["website_forms"]);
  const smsProven = isProven(proofRecords, ["sms_send"]);

  const leadSourceReady = formsProven || smsProven || Boolean(launch.proveCardId);
  // Connect gate uses RFT_CONNECT_CONNECTION_IDS (email + calendar).
  const connectComplete = emailConnected && calendarConnected;
  const connectProvenEnough = emailProven && (calendarProven || leadSourceReady);

  let connectDetail = "Connect business email and calendar.";
  if (connectComplete) {
    connectDetail = "Email and calendar connected.";
  } else if (emailConnected && !calendarConnected) {
    connectDetail = "Email connected — connect calendar next.";
  } else if (calendarConnected && !emailConnected) {
    connectDetail = "Calendar connected — connect business email next.";
  }

  launch.steps.connect = {
    status: connectComplete ? "complete" : "pending",
    at: launch.steps.connect.at,
    detail: connectDetail,
  };

  const hasBaseline = Boolean(observation.baseline && observation.importedAt);
  launch.steps.observe = {
    status: hasBaseline
      ? "complete"
      : (connectComplete ? "ready" : "pending"),
    at: launch.observeCompletedAt ?? observation.importedAt ?? launch.steps.observe.at,
    detail: hasBaseline
      ? `Baseline ready (${observation.events?.length ?? 0} events).`
      : (connectComplete
        ? "Build a baseline from connected history."
        : "Connect channels first."),
  };

  launch.steps.confirm = {
    status: launch.confirmedContentHash
      ? "complete"
      : (hasBaseline || connectComplete ? "ready" : "pending"),
    at: launch.steps.confirm.at,
    detail: launch.confirmedContentHash
      ? "Operating rules confirmed."
      : "Confirm SLAs and what needs your approval.",
  };

  const replayPassed = Boolean(replayState.lastReplay?.passed) || Boolean(launch.replayPassedAt);
  launch.steps.replay = {
    status: replayPassed
      ? "complete"
      : (hasBaseline && launch.confirmedContentHash ? "ready" : "pending"),
    at: launch.replayPassedAt ?? replayState.lastReplay?.ranAt ?? launch.steps.replay.at,
    detail: replayPassed
      ? (replayState.lastReplay?.passDetail ?? "Replay passed.")
      : (hasBaseline
        ? "Replay history against your rules (no sends)."
        : "Complete the baseline first."),
  };

  const shadowPassed = Boolean(replayState.shadow?.passed) || Boolean(launch.shadowPassedAt);
  const shadowEnabled = Boolean(replayState.shadow?.enabled);
  launch.steps.shadow = {
    status: shadowPassed
      ? "complete"
      : (replayPassed ? "ready" : "pending"),
    at: launch.shadowPassedAt ?? replayState.shadow?.passedAt ?? launch.steps.shadow.at,
    detail: shadowPassed
      ? `Shadow passed (${replayState.shadow?.proposals?.length ?? 0} reviewed).`
      : (replayPassed
        ? (shadowEnabled
          ? "Shadow on — review proposals, then mark passed (or pass empty if none yet)."
          : "Propose only — nothing sends outside.")
        : "Pass replay first."),
  };

  launch.steps.prove = {
    status: launch.proveCardId && connectProvenEnough
      ? "complete"
      : (launch.confirmedContentHash ? "ready" : "pending"),
    at: launch.steps.prove.at,
    detail: launch.proveCardId
      ? `Prove opportunity ready`
      : "Prove one real opportunity with evidence.",
  };

  const canGoLive = Boolean(
    launch.steps.connect.status === "complete"
    && hasBaseline
    && launch.confirmedContentHash
    && replayPassed
    && shadowPassed
    && launch.proveCardId
    && connectProvenEnough,
  );
  launch.steps.goLive = {
    status: launch.goLiveAt ? "complete" : (canGoLive ? "ready" : "pending"),
    at: launch.goLiveAt ?? launch.steps.goLive.at,
    detail: launch.goLiveAt
      ? `Live since ${launch.goLiveAt}`
      : (canGoLive
        ? "Ready to go live."
        : "Finish the steps above first."),
  };

  const completeCount = RFT_LAUNCH_STEPS.filter((id) => launch.steps[id].status === "complete").length;
  return deepFreeze({
    ...launch,
    summary: {
      completeCount,
      totalSteps: RFT_LAUNCH_STEPS.length,
      canGoLive,
      goLiveAt: launch.goLiveAt,
      observeReady: hasBaseline,
      replayPassed,
      shadowPassed,
      shadowEnabled,
    },
  });
}

function isConnected(connectionStatuses, keys) {
  for (const key of keys) {
    const raw = connectionStatuses?.[key];
    const status = String(
      typeof raw === "object" ? (raw.status ?? raw.state ?? "") : (raw ?? ""),
    ).toUpperCase();
    if (status === "CONNECTED" || status === "VERIFIED" || status === "PROVEN" || status === "OK") {
      return true;
    }
    if (raw === true) return true;
  }
  return false;
}

function isProven(proofRecords, capabilityIds) {
  for (const id of capabilityIds) {
    const row = proofRecords?.[id];
    if (!row) continue;
    if (row.ok === true && row.verified === true) return true;
    if (row.verified === true && row.detail?.externalReference) return true;
  }
  return false;
}

export function applyRftLaunchPatch(launch, patch = {}, { nowISO = null } = {}) {
  const at = nowISO ?? new Date().toISOString();
  const next = {
    version: 1,
    steps: { ...emptySteps(), ...(launch.steps ?? {}) },
    confirmedContentHash: launch.confirmedContentHash ?? null,
    confirmedContractVersion: launch.confirmedContractVersion ?? null,
    proveCardId: launch.proveCardId ?? null,
    goLiveAt: launch.goLiveAt ?? null,
    observeCompletedAt: launch.observeCompletedAt ?? null,
    replayPassedAt: launch.replayPassedAt ?? null,
    shadowPassedAt: launch.shadowPassedAt ?? null,
    updatedAt: at,
  };

  if (patch.confirmedContentHash != null) {
    next.confirmedContentHash = String(patch.confirmedContentHash);
    next.confirmedContractVersion = patch.confirmedContractVersion
      ? String(patch.confirmedContractVersion)
      : next.confirmedContractVersion;
    next.steps.confirm = {
      status: "complete",
      at,
      detail: `Contract hash ${String(patch.confirmedContentHash).slice(0, 12)}…`,
    };
  }
  if (patch.proveCardId != null) {
    next.proveCardId = String(patch.proveCardId);
    next.steps.prove = {
      status: "complete",
      at,
      detail: `Opportunity ${patch.proveCardId}`,
    };
  }
  if (patch.observeCompleted === true) {
    next.observeCompletedAt = at;
    next.steps.observe = {
      status: "complete",
      at,
      detail: patch.observeDetail ?? "Baseline observation complete.",
    };
  }
  if (patch.replayPassed === true) {
    next.replayPassedAt = at;
    next.steps.replay = {
      status: "complete",
      at,
      detail: patch.replayDetail ?? "Historical replay passed.",
    };
  }
  if (patch.shadowPassed === true) {
    next.shadowPassedAt = at;
    next.steps.shadow = {
      status: "complete",
      at,
      detail: patch.shadowDetail ?? "Shadow mode passed.",
    };
  }
  if (patch.goLive === true) {
    if (!next.confirmedContentHash || !next.proveCardId) {
      return {
        ok: false,
        code: "go_live_requirements",
        message: "Confirm contract and prove one opportunity before go-live.",
        launch: deepFreeze(next),
      };
    }
    if (!next.observeCompletedAt || !next.replayPassedAt || !next.shadowPassedAt) {
      return {
        ok: false,
        code: "go_live_gate",
        message: "Observe, replay, and shadow must pass before go-live.",
        launch: deepFreeze(next),
      };
    }
    next.goLiveAt = at;
    next.steps.goLive = { status: "complete", at, detail: "Go live enabled (approval-gated)." };
  }
  if (patch.markConnectComplete === true) {
    next.steps.connect = {
      status: "complete",
      at,
      detail: patch.connectDetail ?? "Connections marked complete.",
    };
  }

  return { ok: true, launch: deepFreeze(next) };
}

function plainJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function persistRftLaunch({
  platformStore,
  installation,
  launch,
  actorId = "rft_launch",
} = {}) {
  if (!platformStore || !installation) return null;
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId ?? `spec_${installation.businessId}`,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "rft_launch",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
    configuration: {
      ...(installation.configuration ?? {}),
      rftLaunch: plainJson(launch),
    },
    history: Array.isArray(installation.history) ? installation.history.slice(-50) : [],
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return launch;
}
