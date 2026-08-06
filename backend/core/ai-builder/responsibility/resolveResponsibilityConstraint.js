import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

const ASK_RESOLVABLE_TYPES = new Set([
  "BUSINESS_RULE_REQUIRED",
  "CONSENT_POLICY_REQUIRED",
  "KNOWLEDGE_REQUIRED",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function findResponsibilityConstraint(installation, { responsibilityId, constraintId } = {}) {
  const requests = asArray(installation?.configuration?.responsibilityRequests);
  const request = requests.find((row) => String(row?.responsibilityId) === String(responsibilityId)) ?? null;
  const constraint = asArray(request?.constraints)
    .find((row) => String(row?.constraintId) === String(constraintId)) ?? null;
  return deepFreeze({ request, constraint });
}

export function canResolveResponsibilityConstraintInAsk(constraint) {
  return ASK_RESOLVABLE_TYPES.has(String(constraint?.type ?? ""));
}

export function buildResponsibilityConstraintQuestion({ request, constraint } = {}) {
  const title = String(request?.title ?? "this responsibility");
  const description = String(constraint?.description ?? "A business rule is missing.");
  const type = String(constraint?.type ?? "");
  if (type === "CONSENT_POLICY_REQUIRED") {
    return `For “${title},” ${description} Exactly who may receive these messages, and who must never receive them?`;
  }
  if (type === "KNOWLEDGE_REQUIRED") {
    return `For “${title},” ${description} What source or rule should VIBETech rely on?`;
  }
  return `For “${title},” ${description} What exact rule should VIBETech follow?`;
}

export function isUsableConstraintAnswer(answer) {
  const value = String(answer ?? "").trim();
  if (value.length < 3) return false;
  return !/^(i\s*(do not|don't)\s*know|not sure|unsure|skip|idk)$/i.test(value);
}

/**
 * Persist an owner-confirmed answer into both the responsibility constraint and
 * the installed responsibility Operating Contract. This is an explicit Ask
 * resolution, not an inferred learning event.
 */
export async function resolveResponsibilityConstraintFromAsk({
  platformStore,
  installation,
  responsibilityId,
  constraintId,
  answer,
  actorId = null,
  sessionId = null,
  nowISO = new Date().toISOString(),
} = {}) {
  if (!platformStore?.upsertBusinessOSInstallation || !installation) {
    return deepFreeze({ ok: false, reason: "installation_store_required" });
  }
  if (!isUsableConstraintAnswer(answer)) {
    return deepFreeze({ ok: false, reason: "specific_answer_required" });
  }

  const found = findResponsibilityConstraint(installation, { responsibilityId, constraintId });
  if (!found.request || !found.constraint) {
    return deepFreeze({ ok: false, reason: "constraint_not_found" });
  }
  if (!canResolveResponsibilityConstraintInAsk(found.constraint)) {
    return deepFreeze({ ok: false, reason: "constraint_requires_external_evidence" });
  }

  const proofReference = `ask:${sessionId || "session"}:${constraintId}`;
  const requests = asArray(installation.configuration?.responsibilityRequests).map((request) => {
    if (String(request?.responsibilityId) !== String(responsibilityId)) return request;
    const constraints = asArray(request.constraints).map((constraint) => (
      String(constraint?.constraintId) === String(constraintId)
        ? {
          ...constraint,
          status: "resolved",
          resolvedAt: nowISO,
          proofReference,
          resolutionNote: String(answer).trim(),
          resolvedBy: actorId == null ? null : String(actorId),
        }
        : constraint
    ));
    const patch = {
      ...request,
      constraints,
      updatedAt: nowISO,
    };
    const stillOpen = constraints.filter((c) =>
      ["open", "in_progress"].includes(String(c?.status ?? "open"))
      && String(c?.owner ?? "Customer") === "Customer",
    );
    if (!stillOpen.length && String(request.status) !== "live") {
      patch.status = "live";
      patch.wentLiveAt = request.wentLiveAt ?? nowISO;
    }
    if (String(found.constraint.type) === "CONSENT_POLICY_REQUIRED") {
      patch.approvalExpectations = String(answer).trim();
      patch.consentPolicy = {
        text: String(answer).trim(),
        confirmedAt: nowISO,
        constraintId: String(constraintId),
        proofReference,
      };
    } else if (String(found.constraint.type) === "KNOWLEDGE_REQUIRED") {
      patch.requiredInformation = String(answer).trim();
    } else {
      patch.businessRules = [
        ...asArray(request.businessRules),
        { constraintId: String(constraintId), rule: String(answer).trim(), confirmedAt: nowISO },
      ];
    }
    return patch;
  });

  const employees = asArray(installation.configuration?.employees).map((employee) => {
    if (String(employee?.operatingContract?.responsibilityId ?? "") !== String(responsibilityId)) return employee;
    const operatingContract = employee.operatingContract ?? {};
    return {
      ...employee,
      operatingContract: {
        ...operatingContract,
        confirmedRules: [
          ...asArray(operatingContract.confirmedRules),
          {
            constraintId: String(constraintId),
            rule: String(answer).trim(),
            confirmedAt: nowISO,
            proofReference,
          },
        ],
      },
    };
  });

  const historyEntry = {
    event: "responsibility_constraint_resolved",
    at: nowISO,
    responsibilityId: String(responsibilityId),
    constraintId: String(constraintId),
    proofReference,
    actorId: actorId == null ? null : String(actorId),
  };

  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash ?? installation.contentHash ?? "responsibility_resolution",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...(installation.configuration ?? {}),
      responsibilityRequests: requests,
      employees,
    },
    history: [...asArray(installation.history), historyEntry],
    actorUserId: actorId ?? installation.actorUserId ?? null,
    installedAt: installation.installedAt ?? nowISO,
  });

  await platformStore.recordAuditEvent?.({
    actorUserId: actorId,
    businessId: installation.businessId,
    action: "responsibility.constraint_resolved",
    targetType: "responsibility_constraint",
    targetId: String(constraintId),
    metadata: {
      responsibilityId: String(responsibilityId),
      sessionId: sessionId ?? null,
      proofReference,
    },
  }).catch?.(() => null);

  return deepFreeze({
    ok: true,
    responsibilityId: String(responsibilityId),
    constraintId: String(constraintId),
    title: found.request.title ?? "Responsibility",
    proofReference,
    returnHref: `/b/${encodeURIComponent(String(installation.businessId))}/home`,
  });
}
