import assert from "node:assert/strict";
import { test } from "node:test";

import { ContinuousBusinessBuilderService } from "./ContinuousBusinessBuilderService.js";
import { AiBuilderService } from "./AiBuilderService.js";
import { createBusinessOSSpecification } from "../business-os/BusinessOSSpecification.js";

test("continuous builder requires installed specification and keeps same business", async () => {
  const aiBuilder = new AiBuilderService();
  const continuous = new ContinuousBusinessBuilderService({ aiBuilder });
  const denied = await continuous.startImprovement({
    businessId: "biz_1",
    installedSpecification: null,
  });
  assert.equal(denied.ok, false);

  const installed = createBusinessOSSpecification({
    specificationId: "bos_installed",
    businessId: "biz_1",
    businessProfile: { businessName: "Installed Co", industry: "dental" },
    modules: [{ moduleId: "work", label: "Work", moduleType: "operations" }],
    status: "installed",
  });
  const started = await continuous.startImprovement({
    businessId: "biz_1",
    installedSpecification: installed,
    prompt: "Add a referrals workspace",
  });
  assert.equal(started.ok, true);
  assert.equal(started.session.businessId, "biz_1");
  assert.equal(started.session.mode, "expand_existing_business");
  assert.equal(started.session.metadata.continuousImprovement, true);
  assert.ok(started.session.conversation.some((entry) => entry.role === "user" && /referrals/i.test(String(entry.text ?? ""))));
  assert.ok(!started.session.conversation.some((entry) => /what does your business do/i.test(String(entry.text ?? ""))));
  assert.match(started.openHref, /^\/b\/biz_1\/architect\?sessionId=/);
});

test("continuous builder can open a blank Ask chat with no discovery transcript", async () => {
  const aiBuilder = new AiBuilderService();
  const continuous = new ContinuousBusinessBuilderService({ aiBuilder });
  const installed = createBusinessOSSpecification({
    specificationId: "bos_installed",
    businessId: "biz_1",
    businessProfile: { businessName: "Installed Co", industry: "dental" },
    modules: [{ moduleId: "work", label: "Work", moduleType: "operations" }],
    status: "installed",
  });
  const blank = await continuous.startImprovement({
    businessId: "biz_1",
    installedSpecification: installed,
    prompt: "",
  });
  assert.equal(blank.ok, true);
  assert.equal(blank.session.conversation.length, 0);
  assert.equal(blank.session.metadata.askTitle, "New conversation");
  assert.ok(!blank.session.conversation.some((entry) => /what does your business do/i.test(String(entry.text ?? ""))));
});
