import {
  presentPurchasedPackages,
  isFullOsPurchasedScope,
} from "../../../backend/core/platform/packages/SalesPackageCatalog.js";

export type PurchasedPackageView = {
  id: string;
  label: string;
  description: string;
  /** True when this SKU was just added (package-Ask flow). */
  added?: boolean;
};

export type PurchasedPackagesPanel = {
  /** Whether to render the panel at all. */
  show: boolean;
  heading: string;
  /** Full OS / legacy empty-scope businesses render a single summary row. */
  fullOs: boolean;
  packages: PurchasedPackageView[];
  /** Short note under the list — empty when none needed. */
  note: string;
  /** Compact list: labels only, no descriptions. */
  compact: boolean;
};

/**
 * Pure presenter for the "what you bought" panel. All copy comes from the
 * central sales package catalog — never hardcode labels in JSX.
 */
export function composePurchasedPackagesPanel(
  rawIds: unknown,
  options: { addedIds?: unknown; packageAsk?: boolean } = {},
): PurchasedPackagesPanel {
  const ids = Array.isArray(rawIds) ? rawIds.map((entry) => String(entry ?? "")) : [];
  const addedSet = new Set(
    (Array.isArray(options.addedIds) ? options.addedIds : [])
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean),
  );
  const packages = (presentPurchasedPackages(ids) as PurchasedPackageView[]).map((pkg) => ({
    ...pkg,
    added: addedSet.has(pkg.id),
  }));

  // Full OS (explicit ai_business_os or legacy empty scope) shows one summary row.
  if (isFullOsPurchasedScope(ids)) {
    return {
      show: true,
      heading: "Your plan",
      fullOs: true,
      packages: [],
      note: "",
      compact: Boolean(options.packageAsk),
    };
  }

  if (!packages.length) {
    return { show: false, heading: "", fullOs: false, packages: [], note: "", compact: false };
  }

  const packageAsk = Boolean(options.packageAsk);
  const hasNew = packages.some((pkg) => pkg.added);

  return {
    show: true,
    heading: packageAsk ? "Your packages" : (packages.length === 1 ? "Your package" : "Your packages"),
    fullOs: false,
    packages,
    note: packageAsk && hasNew ? "Questions below are only for what’s new." : "",
    compact: packageAsk,
  };
}
