import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { IMPORT_PLAN_ACTION_TYPES } from "./ImportRunStatus.js";

export function deriveImportPlanActionId({ importRunId, rowNumber, actionIndex, actionType } = {}) {
  return `act_import_${String(importRunId ?? "")}_${Number(rowNumber ?? 0)}_${Number(actionIndex ?? 0)}_${String(actionType ?? "")}`;
}

export function createImportPlanAction({ type, payload = {}, actionId = null } = {}) {
  if (!type) throw new Error("ImportPlanAction: type required.");
  if (!Object.values(IMPORT_PLAN_ACTION_TYPES).includes(String(type))) {
    throw new Error(`ImportPlanAction: unsupported type: ${type}`);
  }
  const action = {
    type: String(type),
    payload: deepFreeze(payload && typeof payload === "object" ? { ...payload } : {}),
  };
  if (actionId) action.actionId = String(actionId);
  return deepFreeze(action);
}

export function createImportPlan({ importRunId, actions = [] } = {}) {
  return deepFreeze({
    importRunId: String(importRunId ?? ""),
    actions: deepFreeze(Array.isArray(actions) ? actions.map((a) => (a?.type ? a : createImportPlanAction(a))) : []),
  });
}
