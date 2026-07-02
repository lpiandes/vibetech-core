import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function stableIdPart(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createCompanyBriefAction({ id, label, type, target, priority, metadata } = {}) {
  if (!id || typeof id !== "string") throw new Error("CompanyBriefAction: id required.");
  if (!label || typeof label !== "string") throw new Error("CompanyBriefAction: label required.");
  if (!type || typeof type !== "string") throw new Error("CompanyBriefAction: type required.");
  if (!target || typeof target !== "string") throw new Error("CompanyBriefAction: target required.");

  const p = typeof priority === "string" ? priority : "MEDIUM";

  const action = {
    id,
    label,
    type,
    target,
    priority: p,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(action);
}

export function actionIdPrefix(type) {
  return `action_${stableIdPart(type)}`;
}

