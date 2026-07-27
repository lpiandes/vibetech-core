/**
 * When admin changes purchased packages, sync installation.configuration:
 * - purchasedPackages
 * - inject missing thin-SKU default employees (receptionist, social screener, …)
 * - optionally restore pendingPackageAsk when defaults were missing (broken prior saves)
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  filterEmployeesForPurchasedPackages,
  normalizePurchasedPackages,
  readPendingPackageAsk,
  readPurchasedPackagesFromConfig,
} from "./SalesPackageCatalog.js";

/**
 * Packages whose thin-SKU default employee is not yet on the installation.
 */
export function packagesMissingDefaultEmployees(employees = [], purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  const byId = new Set(
    (Array.isArray(employees) ? employees : [])
      .map((emp) => String(emp?.employeeId ?? emp?.id ?? ""))
      .filter(Boolean),
  );
  const missing = [];
  for (const pkg of packages) {
    const defaults = filterEmployeesForPurchasedPackages([], [pkg]);
    if (!defaults.length) continue;
    const needsInject = defaults.some((def) => {
      const id = String(def?.employeeId ?? def?.id ?? "");
      return id && !byId.has(id);
    });
    if (needsInject) missing.push(pkg);
  }
  return missing;
}

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   added: number,
 *   employees: any[],
 *   configuration: object|null,
 *   packagesInjected: string[],
 *   pendingPackageAsk: object|null,
 *   reason?: string,
 * }>}
 */
export async function syncPurchasedPackagesOntoInstallation({
  platformStore,
  businessId,
  purchasedPackages = [],
  packageConfiguration = null,
  actorId = "platform_admin",
  ensurePendingAsk = true,
} = {}) {
  if (!platformStore || !businessId) {
    return deepFreeze({
      ok: false,
      added: 0,
      employees: [],
      configuration: null,
      packagesInjected: [],
      pendingPackageAsk: null,
      reason: "missing_args",
    });
  }

  const packages = Array.isArray(purchasedPackages) && purchasedPackages.length
    ? normalizePurchasedPackages(purchasedPackages)
    : readPurchasedPackagesFromConfig(packageConfiguration ?? {});

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  if (!installation) {
    return deepFreeze({
      ok: false,
      added: 0,
      employees: [],
      configuration: null,
      packagesInjected: [],
      pendingPackageAsk: readPendingPackageAsk(packageConfiguration ?? {}),
      reason: "no_installation",
    });
  }

  const existing = Array.isArray(installation.configuration?.employees)
    ? [...installation.configuration.employees]
    : [];
  const packagesInjected = packagesMissingDefaultEmployees(existing, packages);

  const byId = new Map(
    existing.map((emp) => [String(emp?.employeeId ?? emp?.id ?? ""), emp]),
  );

  const defaults = filterEmployeesForPurchasedPackages([], packages);
  let added = 0;
  for (const def of defaults) {
    const id = String(def?.employeeId ?? def?.id ?? "");
    if (!id || byId.has(id)) continue;
    byId.set(id, def);
    added += 1;
  }

  const employees = [...byId.values()];

  let pendingPackageAsk = readPendingPackageAsk(packageConfiguration ?? {})
    ?? readPendingPackageAsk(installation.configuration ?? {});

  // Prior bug cleared pending Ask on re-save; recover when we just inject missing workers.
  if (ensurePendingAsk && packagesInjected.length && !pendingPackageAsk) {
    pendingPackageAsk = {
      status: "required",
      packages: packagesInjected,
      createdAt: new Date().toISOString(),
      sessionId: null,
    };
  } else if (pendingPackageAsk) {
    const still = pendingPackageAsk.packages.filter((id) => packages.includes(id));
    pendingPackageAsk = still.length
      ? { ...pendingPackageAsk, packages: still }
      : null;
  }

  const nextConfiguration = {
    ...(installation.configuration ?? {}),
    purchasedPackages: packages,
    employees,
  };
  if (pendingPackageAsk) {
    nextConfiguration.pendingPackageAsk = pendingPackageAsk;
  } else {
    delete nextConfiguration.pendingPackageAsk;
  }

  const packagesChanged =
    JSON.stringify(installation.configuration?.purchasedPackages ?? []) !== JSON.stringify(packages);
  const pendingChanged =
    JSON.stringify(installation.configuration?.pendingPackageAsk ?? null)
    !== JSON.stringify(pendingPackageAsk ?? null);
  const changed = added > 0 || packagesChanged || pendingChanged;

  if (!changed) {
    return deepFreeze({
      ok: true,
      added: 0,
      employees,
      configuration: installation.configuration ?? null,
      packagesInjected: [],
      pendingPackageAsk,
      reason: "noop",
    });
  }

  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${businessId}`,
    businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "sync_purchased_packages",
    planId: installation.planId ?? `plan_${businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: nextConfiguration,
    history: [
      ...(Array.isArray(installation.history) ? installation.history : []),
      {
        at: new Date().toISOString(),
        action: "sync_purchased_packages",
        added,
        packages,
        packagesInjected,
        actorId,
      },
    ],
    actorUserId: installation.actorUserId ?? null,
    installedAt: installation.installedAt ?? null,
  });

  return deepFreeze({
    ok: true,
    added,
    employees,
    configuration: nextConfiguration,
    packagesInjected,
    pendingPackageAsk,
  });
}

/**
 * Home/layout heal: inject missing thin-SKU employees and restore pending Ask on the business row.
 */
export async function healPurchasedPackagesForBusiness({
  platformStore,
  businessId,
  packageConfiguration = null,
  actorId = "home_heal",
} = {}) {
  if (!platformStore || !businessId) {
    return deepFreeze({ ok: false, added: 0, pendingRestored: false });
  }

  const business = packageConfiguration
    ? { packageConfiguration }
    : await platformStore.getBusinessById(businessId).catch(() => null);
  const config = business?.packageConfiguration ?? packageConfiguration ?? {};
  const packages = readPurchasedPackagesFromConfig(config);
  if (!packages.length) {
    return deepFreeze({ ok: true, added: 0, pendingRestored: false, reason: "no_packages" });
  }

  const sync = await syncPurchasedPackagesOntoInstallation({
    platformStore,
    businessId,
    purchasedPackages: packages,
    packageConfiguration: config,
    actorId,
    ensurePendingAsk: true,
  });

  let pendingRestored = false;
  const businessPending = readPendingPackageAsk(config);
  if (sync.pendingPackageAsk && !businessPending && platformStore.updateBusinessPackageConfiguration) {
    const nextConfig = JSON.parse(JSON.stringify({
      ...config,
      purchasedPackages: packages,
      pendingPackageAsk: sync.pendingPackageAsk,
    }));
    await platformStore.updateBusinessPackageConfiguration({
      businessId,
      packageConfiguration: nextConfig,
    });
    pendingRestored = true;
  } else if (
    sync.pendingPackageAsk
    && businessPending
    && platformStore.updateBusinessPackageConfiguration
    && JSON.stringify(businessPending) !== JSON.stringify(sync.pendingPackageAsk)
  ) {
    // Keep business row aligned with installation pending (e.g. sessionId).
    // Only write when we restored missing pending above; otherwise leave business as source of truth.
  }

  // If business had pending but installation sync recovered a fresher one after inject — already handled.
  // If sync restored pending and business lacked it — written above.
  // Also: business may already have purchased packages + pending; sync only updates installation.

  return deepFreeze({
    ok: Boolean(sync.ok),
    added: Number(sync.added ?? 0),
    packagesInjected: sync.packagesInjected ?? [],
    pendingPackageAsk: sync.pendingPackageAsk,
    pendingRestored,
  });
}
