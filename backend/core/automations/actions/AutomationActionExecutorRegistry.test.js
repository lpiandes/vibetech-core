import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AutomationActionExecutorRegistry,
  createDefaultAutomationActionExecutorRegistry,
} from "./AutomationActionExecutorRegistry.js";
import { CreateWorkActionExecutor } from "./CreateWorkActionExecutor.js";

test("AutomationActionExecutorRegistry: register, lookup, duplicate rejection", () => {
  const registry = new AutomationActionExecutorRegistry();
  const executor = {
    actionType: "CREATE_WORK",
    validatePlan: () => ({ ok: true }),
    execute: () => Object.freeze({ status: "COMPLETED" }),
  };

  registry.register(executor);
  assert.equal(registry.getExecutor("CREATE_WORK"), executor);
  assert.deepEqual(registry.listSupportedActionTypes(), ["CREATE_WORK"]);

  assert.throws(() => registry.register(executor), /duplicate executor/);
  assert.throws(() => registry.execute({ action: { actionType: "UNKNOWN" }, context: {} }), /no executor registered/);
});

test("AutomationActionExecutorRegistry: validatePlan runs before execute", () => {
  let validated = false;
  const registry = new AutomationActionExecutorRegistry();
  registry.register({
    actionType: "CREATE_WORK",
    validatePlan: () => {
      validated = true;
      return { ok: true };
    },
    execute: ({ action }) =>
      Object.freeze({
        actionId: action.id,
        status: "COMPLETED",
      }),
  });

  registry.execute({
    action: { id: "act_1", actionType: "CREATE_WORK", parameters: {} },
    context: {},
  });
  assert.equal(validated, true);
});

test("createDefaultAutomationActionExecutorRegistry: registers CreateWorkActionExecutor", () => {
  const registry = createDefaultAutomationActionExecutorRegistry({
    workPlatformEventPublisher: { publishWorkCreated: () => ({ status: "PUBLISHED" }) },
  });
  const executor = registry.getExecutor("CREATE_WORK");
  assert.ok(executor instanceof CreateWorkActionExecutor);
});
