/**
 * Phase 4 growth products that remain soft-sell until marked product+sellable.
 * Entries removed once catalog sellable:true and delivery path is live.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getSalesPackage } from "./SalesPackageCatalog.js";

/** Empty — Wave C growth lines are productized. Kept for API compatibility. */
export const GROWTH_ROADMAP_PACKAGE_IDS = deepFreeze([]);

const BUILD_NOTES = deepFreeze({});

export function listGrowthRoadmapProducts() {
  return deepFreeze(
    GROWTH_ROADMAP_PACKAGE_IDS.map((id) => {
      const pkg = getSalesPackage(id);
      const note = BUILD_NOTES[id] ?? {};
      return {
        packageId: id,
        label: pkg?.label ?? id,
        sheetLine: note.sheetLine ?? pkg?.label ?? id,
        build: note.build ?? pkg?.honestyNote ?? "Roadmap.",
        softSellToday: note.softSellToday ?? null,
        commercialStatus: pkg?.commercialStatus ?? "roadmap",
        sellable: pkg?.sellable === true,
        honestyNote: pkg?.honestyNote ?? null,
        launchMissionIds: pkg?.launchMissionIds ?? [],
      };
    }),
  );
}

export function getGrowthRoadmapProduct(packageId) {
  const id = String(packageId ?? "").trim();
  return listGrowthRoadmapProducts().find((row) => row.packageId === id) ?? null;
}

export function assertGrowthProductsNotSellable() {
  return listGrowthRoadmapProducts().every((row) => row.sellable === false);
}
