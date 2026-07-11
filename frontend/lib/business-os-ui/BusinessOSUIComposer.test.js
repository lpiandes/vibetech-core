import assert from "node:assert/strict";
import { test } from "node:test";

import { composeBusinessOSUI } from "./BusinessOSUIComposer.js";

test("UI composer rejects unregistered dashboard and action types", () => {
  const composed = composeBusinessOSUI({
    navigation: [{ moduleId: "work", label: "Work" }],
    dashboardCards: [
      { id: "a", componentType: "work_queue", title: "Work" },
      { id: "b", componentType: "custom_evil_widget", title: "Nope" },
    ],
    actions: [
      { id: "1", componentType: "approve_reject", label: "Decide" },
      { id: "2", componentType: "eval_script", label: "Bad" },
    ],
  });
  assert.equal(composed.dashboardCards.length, 1);
  assert.deepEqual(composed.rejected.dashboardCards, ["custom_evil_widget"]);
  assert.deepEqual(composed.rejected.actions, ["eval_script"]);
});
