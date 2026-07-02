import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { SECTION_IDS } from "./CompanyBriefDefaults.js";

const allowedSectionIds = new Set(Object.values(SECTION_IDS));

export function createCompanyBriefSection({
  id,
  title,
  subtitle,
  status,
  priority,
  summary,
  items,
  actions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") throw new Error("CompanyBriefSection: id required.");
  if (!allowedSectionIds.has(id)) throw new Error(`CompanyBriefSection: invalid id: ${id}`);
  if (!title || typeof title !== "string") throw new Error("CompanyBriefSection: title required.");

  const section = {
    id,
    title,
    subtitle: String(subtitle ?? ""),
    status: String(status ?? "READY"),
    priority: String(priority ?? "MEDIUM"),
    summary: String(summary ?? ""),
    items: Array.isArray(items) ? deepFreeze(items) : deepFreeze([]),
    actions: Array.isArray(actions) ? deepFreeze(actions) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(section);
}

export function isCompanyBriefSectionId(id) {
  return allowedSectionIds.has(String(id));
}

