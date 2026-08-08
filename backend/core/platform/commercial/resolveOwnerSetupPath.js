/**
 * Decide which Today setup path to show, and evaluate step completion from real evidence.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getOwnerSetupSteps, getConsultingSetupCard } from "./OwnerPackageSetupRegistry.js";
import { getSalesPackage } from "../packages/SalesPackageCatalog.js";
import {
  resolveWhiteGloveOwnerPhase,
  whiteGloveAttestationSatisfiesTest,
  whiteGloveBlocksConnectComplete,
  whiteGloveConnectionSatisfiesConnect,
} from "../../integrations/whiteglove/whiteGloveOpsState.js";
import { anyProofOk } from "../../integrations/connectionProveRegistry.js";
import { smsConnectStepComplete, smsCarrierOwnerCopy } from "../../integrations/sms/smsCarrierStatus.js";

const RFT_PACKAGE_ID = "managed_revenue_follow_through";

const PRODUCT_STATUSES = new Set(["product", "managed_product"]);

function normalizePackages(purchasedPackages = []) {
  return [...new Set((Array.isArray(purchasedPackages) ? purchasedPackages : []).map(String).filter(Boolean))];
}

function statusConnected(raw) {
  const status = String(
    typeof raw === "object" && raw != null
      ? (raw.status ?? raw.state ?? "")
      : (raw ?? ""),
  ).toUpperCase();
  return status === "CONNECTED" || status === "VERIFIED" || status === "PROVEN" || status === "OK" || raw === true;
}

function proofOk(proofRecords, missionIdOrIds) {
  if (!missionIdOrIds || !proofRecords) return false;
  const ids = Array.isArray(missionIdOrIds) ? missionIdOrIds : [missionIdOrIds];
  return anyProofOk(proofRecords, ids);
}

/**
 * @param {{
 *   purchasedPackages?: string[],
 *   rftGoLiveAt?: string | null,
 *   packageSetupGoLiveAt?: string | null,
 *   packageSetupById?: Record<string, { goLiveAt?: string | null }> | null,
 * }} input
 */
export function resolveOwnerSetupPath(input = {}) {
  const packages = normalizePackages(input.purchasedPackages);
  const hasRft = packages.includes(RFT_PACKAGE_ID);
  const rftLive = Boolean(input.rftGoLiveAt);

  const productIds = packages.filter((id) => {
    if (id === RFT_PACKAGE_ID) return false;
    const pkg = getSalesPackage(id);
    if (!pkg) return false;
    return PRODUCT_STATUSES.has(String(pkg.commercialStatus ?? "product")) && pkg.sellable !== false;
  });

  const pendingProduct = productIds.filter((id) => {
    const byId = input.packageSetupById?.[id]?.goLiveAt;
    if (byId) return false;
    if (input.packageSetupGoLiveAt && productIds.length === 1) return false;
    return true;
  });

  // RFT + product packages: show both setup paths until each is live.
  if (hasRft && !rftLive && pendingProduct.length) {
    return deepFreeze({
      mode: "rft_and_package",
      primaryPackageId: pendingProduct[0],
      packageIds: pendingProduct,
      showCustomBuild: pendingProduct.some((id) => {
        const pkg = getSalesPackage(id);
        return /custom|ai_business_os|multi_system/i.test(String(id))
          || String(pkg?.honestyNote ?? "").toLowerCase().includes("custom build");
      }),
      showRft: true,
      showPackage: true,
    });
  }

  if (hasRft && !rftLive) {
    return deepFreeze({
      mode: "rft",
      primaryPackageId: RFT_PACKAGE_ID,
      packageIds: packages,
      showCustomBuild: false,
      showRft: true,
      showPackage: false,
    });
  }

  if (pendingProduct.length) {
    return deepFreeze({
      mode: "package",
      primaryPackageId: pendingProduct[0],
      packageIds: pendingProduct,
      showCustomBuild: pendingProduct.some((id) => {
        const pkg = getSalesPackage(id);
        return /custom|ai_business_os|multi_system/i.test(String(id))
          || String(pkg?.honestyNote ?? "").toLowerCase().includes("custom build");
      }),
      showRft: false,
      showPackage: true,
    });
  }

  if (!packages.length) {
    return deepFreeze({
      mode: "empty",
      primaryPackageId: null,
      packageIds: [],
      showCustomBuild: false,
      showRft: false,
      showPackage: false,
    });
  }

  const onlyConsulting = packages.every((id) => {
    if (id === RFT_PACKAGE_ID) return rftLive;
    const pkg = getSalesPackage(id);
    if (!pkg) return true;
    if (PRODUCT_STATUSES.has(String(pkg.commercialStatus ?? "")) && pkg.sellable !== false) {
      return Boolean(input.packageSetupById?.[id]?.goLiveAt || input.packageSetupGoLiveAt);
    }
    return true;
  });

  if (onlyConsulting && !productIds.length && !hasRft) {
    return deepFreeze({
      mode: "consulting",
      primaryPackageId: packages[0] ?? null,
      packageIds: packages,
      showCustomBuild: false,
      showRft: false,
      showPackage: true,
    });
  }

  const showCustomBuild = packages.some((id) =>
    ["ai_business_os", "multi_system_integration"].includes(id)
    || String(getSalesPackage(id)?.commercialStatus) === "human_service",
  );

  return deepFreeze({
    mode: "live",
    primaryPackageId: productIds[0] ?? packages[0] ?? null,
    packageIds: packages,
    showCustomBuild,
    showRft: false,
    showPackage: false,
  });
}

/**
 * Evaluate one package checklist against live connection + proof evidence.
 */
export function evaluateOwnerSetupSteps({
  packageId,
  connectionStatuses = {},
  proofRecords = {},
  knowledgeCount = 0,
  goLiveAt = null,
  pendingOpsRequests = {},
} = {}) {
  const steps = getOwnerSetupSteps(packageId);
  const idsConnected = (ids = [], { emptyMeansComplete = false } = {}) => {
    if (!ids.length) return emptyMeansComplete;
    if (whiteGloveBlocksConnectComplete({
      connectionIds: ids,
      connectionStatuses,
      pendingOpsRequests,
    })) {
      return false;
    }
    return ids.some((id) => {
      const raw = connectionStatuses[id];
      // SMS Connect is Connected + carrier approved — never skip A2P via "live status".
      if (String(id) === "sms_channel" || String(id) === "sms") {
        return smsConnectStepComplete(raw);
      }
      return statusConnected(raw)
        || whiteGloveConnectionSatisfiesConnect({
          connectionId: id,
          connectionStatus: raw,
          pendingOpsRequests,
        });
    });
  };
  const connectDetail = (ids = [], hint = null) => {
    if (!ids.length) return hint ?? "Open Connections to finish this step.";
    const smsRaw = connectionStatuses.sms_channel ?? connectionStatuses.sms;
    if (ids.some((id) => id === "sms_channel" || id === "sms") && statusConnected(smsRaw) && !smsConnectStepComplete(smsRaw)) {
      return smsCarrierOwnerCopy(smsRaw);
    }
    if (ids.some((id) => {
      const raw = connectionStatuses[id];
      if (String(id) === "sms_channel" || String(id) === "sms") return smsConnectStepComplete(raw);
      return statusConnected(raw);
    })) {
      return "Connected.";
    }
    if (ids.some((id) => whiteGloveConnectionSatisfiesConnect({
      connectionId: id,
      connectionStatus: connectionStatuses[id],
      pendingOpsRequests,
    }))) {
      return "Ready — VIBETech finished setup.";
    }
    for (const id of ids) {
      const phase = resolveWhiteGloveOwnerPhase({
        connectionId: id,
        connectionStatus: connectionStatuses[id],
        pendingOpsRequests,
      });
      if (phase === "pending") {
        return "Hold on — VIBETech is setting this up for you.";
      }
      if (phase === "good_to_go") {
        return "Good to go — open Connections, confirm Connected, then Test it.";
      }
      if (phase === "request") {
        return hint ?? `Request setup for ${String(id).replace(/_/g, " ")}.`;
      }
    }
    return hint ?? `Connect ${ids[0].replace(/_/g, " ")}.`;
  };

  const evaluated = steps.map((s) => {
    let complete = false;
    let detail = s.hint ?? null;

    if (s.kind === "consulting") {
      complete = false;
      detail = s.hint;
    } else if (s.kind === "connect") {
      const ids = s.connectionIds?.length ? s.connectionIds : [];
      complete = idsConnected(ids, { emptyMeansComplete: false });
      detail = complete ? "Connected." : connectDetail(ids, detail);
    } else if (s.kind === "knowledge") {
      complete = Number(knowledgeCount) > 0;
      detail = complete ? "Knowledge added." : (detail ?? "Upload at least one document.");
    } else if (s.kind === "test") {
      const proveIds = s.proveMissionIds?.length ? s.proveMissionIds : s.proveMissionId;
      const attested = whiteGloveAttestationSatisfiesTest({
        connectionIds: s.connectionIds ?? [],
        connectionStatuses,
        pendingOpsRequests,
      });
      complete = proofOk(proofRecords, proveIds) || attested;
      detail = complete
        ? (attested && !proofOk(proofRecords, proveIds)
          ? "Custom Build attested — ready for go-live."
          : "Tested with real evidence.")
        : (detail ?? "Run a real test before go-live.");
    } else if (s.kind === "go_live") {
      const priors = steps.filter((x) => x.kind !== "go_live" && x.kind !== "consulting");
      const priorsDone = priors.every((p) => {
        if (p.kind === "connect") {
          return idsConnected(p.connectionIds ?? [], { emptyMeansComplete: true });
        }
        if (p.kind === "knowledge") return Number(knowledgeCount) > 0;
        if (p.kind === "test") {
          const proveIds = p.proveMissionIds?.length ? p.proveMissionIds : p.proveMissionId;
          return proofOk(proofRecords, proveIds)
            || whiteGloveAttestationSatisfiesTest({
              connectionIds: p.connectionIds ?? [],
              connectionStatuses,
              pendingOpsRequests,
            });
        }
        return true;
      });
      complete = Boolean(goLiveAt);
      detail = complete
        ? `Live since ${goLiveAt}`
        : priorsDone
          ? "Ready to go live."
          : "Finish the steps above first.";
    }

    return {
      ...s,
      complete,
      detail,
      ready: s.kind === "go_live"
        ? !complete && steps.filter((x) => x.kind !== "go_live").every((p) => {
          if (p.kind === "connect") {
            return idsConnected(p.connectionIds ?? [], { emptyMeansComplete: true });
          }
          if (p.kind === "knowledge") return Number(knowledgeCount) > 0;
          if (p.kind === "test") {
            const proveIds = p.proveMissionIds?.length ? p.proveMissionIds : p.proveMissionId;
            return proofOk(proofRecords, proveIds)
              || whiteGloveAttestationSatisfiesTest({
                connectionIds: p.connectionIds ?? [],
                connectionStatuses,
                pendingOpsRequests,
              });
          }
          if (p.kind === "consulting") return true;
          return true;
        })
        : !complete,
    };
  });

  const completeCount = evaluated.filter((s) => s.complete).length;
  const next = evaluated.find((s) => !s.complete) ?? null;
  const canGoLive = Boolean(evaluated.find((s) => s.kind === "go_live" && s.ready && !s.complete));

  return deepFreeze({
    packageId,
    title: getSalesPackage(packageId)?.label ?? packageId,
    steps: evaluated,
    summary: {
      completeCount,
      totalSteps: evaluated.length,
      canGoLive,
      goLiveAt: goLiveAt ?? null,
      nextStepId: next?.id ?? null,
      complete: Boolean(goLiveAt) || (evaluated.length > 0 && completeCount === evaluated.length),
    },
  });
}

export function presentConsultingSetup(packageId = null) {
  return deepFreeze({
    packageId,
    title: "Working with VIBETech",
    steps: getConsultingSetupCard().map((s) => ({ ...s, complete: false, detail: s.hint, ready: false })),
    summary: {
      completeCount: 0,
      totalSteps: 1,
      canGoLive: false,
      goLiveAt: null,
      nextStepId: "consulting",
      complete: false,
    },
  });
}

/**
 * Next Connections banner target from incomplete connect steps.
 */
export function resolveNextConnectionFocus({
  purchasedPackages = [],
  connectionStatuses = {},
  packageSetupById = null,
  packageSetupGoLiveAt = null,
} = {}) {
  const path = resolveOwnerSetupPath({
    purchasedPackages,
    packageSetupById,
    packageSetupGoLiveAt,
  });
  if (path.mode !== "package" && path.mode !== "rft_and_package") {
    return deepFreeze({ connectionId: null, label: null });
  }

  for (const packageId of path.packageIds) {
    const steps = getOwnerSetupSteps(packageId);
    for (const s of steps) {
      if (s.kind !== "connect") continue;
      const ids = s.connectionIds ?? [];
      const done = ids.length ? ids.some((id) => statusConnected(connectionStatuses[id])) : false;
      if (done) continue;
      const focus = s.focusConnectionId || ids[0] || null;
      return deepFreeze({
        connectionId: focus,
        label: s.label.replace(/^Connect\s+/i, "") || "required connection",
        packageId,
      });
    }
  }
  return deepFreeze({ connectionId: null, label: null });
}
