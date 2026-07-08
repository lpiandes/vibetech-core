import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { AUTOMATION_ACTION_TYPES } from "../AutomationAction.js";
import { CreateWorkActionExecutor } from "./CreateWorkActionExecutor.js";

function fail(message) {
  throw new Error(`AutomationActionExecutorRegistry: ${message}`);
}

export class AutomationActionExecutorRegistry {
  constructor({ executors } = {}) {
    this._executors = new Map();
    if (executors && typeof executors === "object") {
      for (const executor of Object.values(executors)) {
        this.register(executor);
      }
    }
  }

  register(executor) {
    if (!executor || typeof executor !== "object") fail("executor required.");
    const actionType = String(executor.actionType ?? "");
    if (!actionType) fail("executor.actionType required.");
    if (this._executors.has(actionType)) fail(`duplicate executor for actionType: ${actionType}`);
    if (typeof executor.execute !== "function") fail(`executor.execute required for actionType: ${actionType}`);
    if (typeof executor.validatePlan !== "function") fail(`executor.validatePlan required for actionType: ${actionType}`);
    this._executors.set(actionType, executor);
    return executor;
  }

  getExecutor(actionType) {
    return this._executors.get(String(actionType ?? "")) ?? null;
  }

  listSupportedActionTypes() {
    return [...this._executors.keys()];
  }

  execute({ action, context } = {}) {
    if (!action || typeof action !== "object") fail("execute requires action.");
    const at = String(action.actionType);
    const executor = this._executors.get(at);
    if (!executor) fail(`no executor registered for actionType: ${at}`);

    executor.validatePlan({ action });

    const frozenAction = deepFreeze({
      ...action,
      parameters: action.parameters ?? {},
    });

    return executor.execute({ action: frozenAction, context });
  }
}

export function createDefaultAutomationActionExecutorRegistry({
  workCreationService,
  workPlatformEventPublisher,
} = {}) {
  const registry = new AutomationActionExecutorRegistry();
  registry.register(
    new CreateWorkActionExecutor({
      workCreationService,
      workPlatformEventPublisher,
    }),
  );
  return registry;
}

export { AUTOMATION_ACTION_TYPES };
