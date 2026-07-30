import { normalizePurchasedPackages, isFullOsPurchasedScope } from "../../platform/packages/SalesPackageCatalog.js";

export function readPurchasedPackagesFromInstallation(installation) {
  return installation?.configuration?.purchasedPackages ?? installation?.purchasedPackages ?? [];
}

export function businessHasAppointmentSetter(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (packages.includes("appointment_setter")) return true;
  return isFullOsPurchasedScope(packages);
}
