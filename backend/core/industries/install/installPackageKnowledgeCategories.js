import { COMPANY_EVENT_TYPES } from "../../company/events/CompanyEventTypes.js";
import { createCompanyEvent } from "../../company/events/CompanyEvent.js";

function fail(message) {
  throw new Error(`installPackageKnowledgeCategories: ${message}`);
}

export function installPackageKnowledgeCategories({
  knowledgeCategories,
  companyRuntime,
  nowISO,
  installedCategoryIds = [],
} = {}) {
  if (!companyRuntime || typeof companyRuntime.applyEvent !== "function") {
    fail("companyRuntime required.");
  }

  const defs = Array.isArray(knowledgeCategories) ? knowledgeCategories : [];
  const installedIds = [...installedCategoryIds];
  const timestampISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  const existing = companyRuntime.getKnowledgeCategories?.()?.items ?? [];

  for (const def of defs) {
    const catId = String(def.id ?? "");
    if (!catId) continue;
    if (existing.some((c) => String(c.id) === catId) || installedIds.includes(catId)) {
      if (!installedIds.includes(catId)) installedIds.push(catId);
      continue;
    }

    companyRuntime.applyEvent(
      createCompanyEvent({
        id: `evt_pkg_cat_${catId}_${timestampISO}`,
        timestampISO,
        type: COMPANY_EVENT_TYPES.CATEGORY_CREATED,
        source: "industry_package_installer",
        payload: {
          id: catId,
          name: String(def.name ?? catId),
          description: String(def.description ?? ""),
          icon: String(def.icon ?? ""),
          color: String(def.color ?? ""),
          sortOrder: Number(def.sortOrder ?? 500),
          parentCategory: def.parentCategory ?? null,
          childCategories: Array.isArray(def.childCategories) ? def.childCategories : [],
          defaultTags: Array.isArray(def.defaultTags) ? def.defaultTags : [],
          searchable: def.searchable !== false,
          editable: def.editable !== false,
          version: 1,
          status: "ACTIVE",
          visibility: String(def.visibility ?? "INTERNAL"),
          createdAt: timestampISO,
          updatedAt: timestampISO,
          createdBy: "industry_package_installer",
          updatedBy: "industry_package_installer",
          metadata: def.metadata && typeof def.metadata === "object" ? def.metadata : { derivedFrom: { industryPackage: true } },
        },
      }),
    );
    installedIds.push(catId);
  }

  return { categoryIds: installedIds };
}
