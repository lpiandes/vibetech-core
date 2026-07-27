import {
  mergePackEmployeesIntoList,
  resolveOperatingIndustry,
} from "../../../backend/core/ai-builder/mapPackAiRolesToSelectedEmployees.js";

/**
 * Heal installed Business OS config that predates pack-default workforce policy.
 * Merges missing pack AI roles into configuration.employees and persists when needed.
 *
 * @returns {Promise<{employees: any[], healed: boolean, added: number, industry: string | null}>}
 */
export async function reconcilePackWorkforce({
  platformStore,
  businessId,
  installation = null,
  specification = null,
  industry = null,
  businessName = null,
  operatingPackId = null,
} = /** @type {{
  platformStore?: any,
  businessId?: string,
  installation?: any,
  specification?: any,
  industry?: string | null,
  businessName?: string | null,
  operatingPackId?: string | null,
}} */ ({})) {
  if (!platformStore || !businessId) {
    return { employees: [], healed: false, added: 0, industry: null };
  }

  const install = installation
    ?? await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  if (!install) {
    return { employees: [], healed: false, added: 0, industry: null };
  }

  const resolvedName = businessName
    ?? specification?.businessProfile?.businessName
    ?? install?.configuration?.businessProfile?.businessName
    ?? null;

  const packIndustry = resolveOperatingIndustry({
    industry,
    businessName: resolvedName,
    operatingPackId: operatingPackId
      ?? specification?.operatingPackId
      ?? install?.configuration?.operatingPackId
      ?? null,
    specification,
    configuration: install?.configuration ?? null,
  });

  const existing = Array.isArray(install.configuration?.employees)
    ? install.configuration.employees
    : [];

  if (!packIndustry) {
    return { employees: existing, healed: false, added: 0, industry: null };
  }

  const { employees, added } = mergePackEmployeesIntoList(existing, packIndustry, {
    businessName: resolvedName,
  });

  if (!added) {
    return { employees, healed: false, added: 0, industry: packIndustry };
  }

  const nextConfiguration = {
    ...(install.configuration ?? {}),
    employees,
    businessProfile: {
      ...(install.configuration?.businessProfile ?? {}),
      industry: packIndustry,
      businessName: resolvedName
        ?? install.configuration?.businessProfile?.businessName
        ?? null,
    },
    operatingPackId: install.configuration?.operatingPackId
      ?? (packIndustry === "sports" ? "youth_sports_v1" : `${packIndustry}_v1`),
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
        ?? "reconcile_pack_workforce",
      planId: install.planId ?? `plan_${businessId}`,
      status: install.status ?? "installed",
      plan: install.plan ?? {},
      actionCheckpoints: install.actionCheckpoints ?? [],
      configuration: nextConfiguration,
      history: [
        ...(Array.isArray(install.history) ? install.history : []),
        {
          at: new Date().toISOString(),
          action: "reconcile_pack_workforce",
          added,
          industry: packIndustry,
        },
      ],
      actorUserId: install.actorUserId ?? null,
      installedAt: install.installedAt ?? null,
    });
  } catch {
    return { employees, healed: true, added, industry: packIndustry };
  }

  return { employees, healed: true, added, industry: packIndustry };
}
