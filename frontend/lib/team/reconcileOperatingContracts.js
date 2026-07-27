import {
  ensureEmployeeOperatingContract,
} from "../../../backend/core/ai-builder/operating-contract/buildOperatingContract.js";
import { resolveOperatingIndustry } from "../../../backend/core/ai-builder/mapPackAiRolesToSelectedEmployees.js";

/**
 * Seed operatingContract (+ automation stub) on every installed employee missing one.
 */
export async function reconcileOperatingContracts({
  platformStore,
  businessId,
  installation = null,
  specification = null,
  industry = null,
  businessName = null,
  discoverySummary = null,
} = {}) {
  if (!platformStore || !businessId) {
    return { employees: [], healed: false, updated: 0, industry: null };
  }

  const install = installation
    ?? await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  if (!install) {
    return { employees: [], healed: false, updated: 0, industry: null };
  }

  const packIndustry = resolveOperatingIndustry({
    industry,
    businessName: businessName
      ?? specification?.businessProfile?.businessName
      ?? install?.configuration?.businessProfile?.businessName
      ?? null,
    operatingPackId: specification?.operatingPackId
      ?? install?.configuration?.operatingPackId
      ?? null,
    specification,
    configuration: install?.configuration ?? null,
  });

  const existing = Array.isArray(install.configuration?.employees)
    ? [...install.configuration.employees]
    : [];

  let updated = 0;
  const employees = existing.map((employee) => {
    if (employee?.operatingContract?.version && Array.isArray(employee?.automationDefinitions)
      && employee.automationDefinitions.length > 0) {
      return employee;
    }
    updated += 1;
    const { _operatingContractMeta, ...rest } = ensureEmployeeOperatingContract(employee, {
      industry: packIndustry,
      discoverySummary: discoverySummary
        ?? install?.configuration?.businessSummary
        ?? specification?.businessProfile
        ?? null,
    });
    return rest;
  });

  if (!updated) {
    return { employees, healed: false, updated: 0, industry: packIndustry };
  }

  const nextConfiguration = {
    ...(install.configuration ?? {}),
    employees,
  };

  try {
    await platformStore.upsertBusinessOSInstallation({
      id: install.id ?? install.installationId ?? `install_${businessId}`,
      businessId,
      specificationRowId: install.specificationRowId ?? null,
      specificationId: install.specificationId,
      specificationVersion: install.specificationVersion ?? 1,
      specificationContentHash: install.specificationContentHash
        ?? install.contentHash
        ?? "reconcile_operating_contracts",
      planId: install.planId ?? `plan_${businessId}`,
      status: install.status ?? "installed",
      plan: install.plan ?? {},
      actionCheckpoints: install.actionCheckpoints ?? [],
      configuration: nextConfiguration,
      history: [
        ...(Array.isArray(install.history) ? install.history : []),
        {
          at: new Date().toISOString(),
          action: "reconcile_operating_contracts",
          updated,
          industry: packIndustry,
        },
      ],
      actorUserId: install.actorUserId ?? null,
      installedAt: install.installedAt ?? null,
    });
  } catch {
    return { employees, healed: true, updated, industry: packIndustry };
  }

  return { employees, healed: true, updated, industry: packIndustry };
}
