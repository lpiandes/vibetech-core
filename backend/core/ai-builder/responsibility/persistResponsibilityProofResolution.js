import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * After a capability is Proven, persist matching ACCOUNT_CONNECTION constraints
 * as resolved and promote ready responsibilities to live without freezing others.
 */

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

const CAPABILITY_TO_CHANNEL = Object.freeze({
  customer_email_send: ["business_email", "gmail", "email"],
  calendar_scheduling: ["calendar", "google_calendar"],
  sms_send: ["sms_channel", "sms", "twilio"],
  voice_calls: ["voice_channel", "voice", "phone", "call"],
  meta_lead_intake: ["meta_lead_ads", "meta", "facebook"],
  website_forms: ["website_forms", "form"],
  crm_hubspot: ["hubspot", "crm"],
  crm_highlevel: ["highlevel", "crm"],
});

function textBlob(constraint) {
  return [
    constraint?.description,
    constraint?.resolutionAction,
    constraint?.evidenceNeeded,
    constraint?.channelId,
    constraint?.capabilityId,
  ].map((v) => String(v ?? "")).join(" ").toLowerCase();
}

function constraintMatchesCapability(constraint, capabilityId) {
  if (String(constraint?.type ?? "") !== "ACCOUNT_CONNECTION_REQUIRED") return false;
  if (String(constraint?.capabilityId ?? "") === String(capabilityId)) return true;
  const aliases = CAPABILITY_TO_CHANNEL[String(capabilityId)] ?? [];
  const blob = textBlob(constraint);
  return aliases.some((alias) => blob.includes(String(alias).toLowerCase()));
}

function openCustomerConstraints(constraints) {
  return asArray(constraints).filter((c) =>
    ["open", "in_progress"].includes(String(c?.status ?? "open"))
    && String(c?.owner ?? "Customer") === "Customer",
  );
}

/**
 * @param {{
 *   platformStore: any,
 *   installation: object,
 *   capabilityId: string,
 *   proveAction?: string|null,
 *   proofReference?: string|null,
 *   actorId?: string|null,
 *   nowISO?: string,
 * }} input
 */
export async function persistResponsibilityProofResolution({
  platformStore,
  installation,
  capabilityId,
  proveAction = null,
  proofReference = null,
  actorId = null,
  nowISO = new Date().toISOString(),
} = {}) {
  if (!platformStore?.upsertBusinessOSInstallation || !installation) {
    return deepFreeze({ ok: false, reason: "installation_required" });
  }
  const cap = String(capabilityId ?? "");
  if (!cap) return deepFreeze({ ok: false, reason: "capability_required" });

  const ref = String(proofReference ?? proveAction ?? cap);
  let changed = 0;
  let promoted = 0;

  const requests = asArray(installation.configuration?.responsibilityRequests).map((request) => {
    if (!request || String(request.status) === "removed") return request;
    let touched = false;
    const constraints = asArray(request.constraints).map((constraint) => {
      if (!constraintMatchesCapability(constraint, cap)) return constraint;
      if (["resolved", "accepted_fallback", "wont_fix"].includes(String(constraint.status ?? ""))) {
        return constraint;
      }
      touched = true;
      changed += 1;
      return {
        ...constraint,
        status: "resolved",
        resolvedAt: nowISO,
        proofReference: ref,
        capabilityId: constraint.capabilityId ?? cap,
        resolvedBy: actorId == null ? null : String(actorId),
      };
    });
    if (!touched) return request;

    const stillOpen = openCustomerConstraints(constraints);
    const nextStatus = stillOpen.length === 0 && String(request.status) !== "live"
      ? "live"
      : request.status;
    if (nextStatus === "live" && String(request.status) !== "live") promoted += 1;

    return {
      ...request,
      constraints,
      status: nextStatus,
      updatedAt: nowISO,
      ...(nextStatus === "live" ? { wentLiveAt: request.wentLiveAt ?? nowISO } : {}),
    };
  });

  if (!changed) {
    return deepFreeze({ ok: true, changed: 0, promoted: 0, capabilityId: cap });
  }

  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash ?? installation.contentHash ?? "proof_resolution",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...(installation.configuration ?? {}),
      responsibilityRequests: requests,
    },
    history: [
      ...asArray(installation.history),
      {
        event: "responsibility_proof_resolved",
        at: nowISO,
        capabilityId: cap,
        proofReference: ref,
        changed,
        promoted,
        actorId: actorId == null ? null : String(actorId),
      },
    ],
    actorUserId: actorId ?? installation.actorUserId ?? null,
    installedAt: installation.installedAt ?? nowISO,
  });

  return deepFreeze({
    ok: true,
    changed,
    promoted,
    capabilityId: cap,
    proofReference: ref,
  });
}
