import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePurchasedPackages,
  mergePurchasedPackagesIntoConfig,
  preservePurchasedPackagesConfig,
  presentPurchasedPackages,
  presentLaunchPathLabel,
  resolvePurchasedPackageScope,
  questionMatchesPurchasedPackages,
  filterModulesForPurchasedPackages,
  filterLaunchMissionsForPurchasedPackages,
  filterEmployeesForPurchasedPackages,
  filterCanonicalNavForPurchasedPackages,
  resolveCanonicalNavIdsForPackages,
  listSalesPackagesForAdmin,
  listSellableSalesPackagesForAdmin,
  resolvePackageSoftCaps,
  filterWorkflowsForPurchasedPackages,
  isFullOsPurchasedScope,
  applyPurchasedPackagesChange,
  readPendingPackageAsk,
  clearPendingPackageAsk,
} from "./SalesPackageCatalog.js";

test("admin catalog lists sales packages", () => {
  const rows = listSalesPackagesForAdmin();
  assert.ok(rows.some((row) => row.id === "ai_receptionist"));
  assert.ok(rows.some((row) => row.id === "ai_business_os" && row.fullOs));
  const chatbot = rows.find((row) => row.id === "website_chatbot");
  assert.match(String(chatbot?.honestyNote ?? ""), /forms/i);
});

test("normalize drops unknowns and dedupes", () => {
  assert.deepEqual(
    normalizePurchasedPackages(["ai_receptionist", "nope", "ai_receptionist", "lead_follow_up"]),
    ["ai_receptionist", "lead_follow_up"],
  );
});

test("purchased package presentation comes from catalog", () => {
  assert.deepEqual(
    presentPurchasedPackages(["ai_receptionist", "crm_automation", "unknown"]),
    [
      {
        id: "ai_receptionist",
        label: "AI Receptionist",
        description: "Inbound phone answers from Knowledge; call notes in People. Booking requests create appointment Work and a calendar HOLD when Calendar is connected.",
      },
      {
        id: "crm_automation",
        label: "CRM automation",
        description: "People, pipelines, and work automation (in-platform CRM).",
      },
    ],
  );
})

test("empty packages means full OS scope", () => {
  assert.equal(isFullOsPurchasedScope([]), true);
  assert.equal(resolvePurchasedPackageScope([]).fullOs, true);
  assert.equal(resolvePurchasedPackageScope(["ai_business_os"]).fullOs, true);
  assert.equal(resolvePurchasedPackageScope(["ai_receptionist"]).fullOs, false);
});

test("receptionist scope limits topics and modules", () => {
  const scope = resolvePurchasedPackageScope(["ai_receptionist"]);
  assert.equal(scope.fullOs, false);
  assert.ok(scope.topics.has("communications"));
  assert.ok(scope.moduleIds.has("knowledge"));
  assert.equal(scope.moduleIds.has("digital_workforce"), false);
  assert.equal(
    questionMatchesPurchasedPackages({ topic: "team" }, ["ai_receptionist"]),
    false,
  );
  assert.equal(
    questionMatchesPurchasedPackages({ topic: "identity" }, ["ai_receptionist"]),
    true,
  );
  const modules = filterModulesForPurchasedPackages(
    [
      { moduleId: "home" },
      { moduleId: "digital_workforce" },
      { moduleId: "knowledge" },
    ],
    ["ai_receptionist"],
  );
  assert.deepEqual(modules.map((m) => m.moduleId), ["home", "knowledge"]);
});

test("merge and preserve purchasedPackages in config", () => {
  const merged = mergePurchasedPackagesIntoConfig({ companyName: "Acme" }, ["ai_receptionist"]);
  assert.equal(merged.companyName, "Acme");
  assert.deepEqual(merged.purchasedPackages, ["ai_receptionist"]);
  assert.deepEqual(
    preservePurchasedPackagesConfig(merged),
    { purchasedPackages: ["ai_receptionist"] },
  );
});

test("receptionist + CRM launch missions exclude Meta and sports golden path", () => {
  const missions = filterLaunchMissionsForPurchasedPackages(
    [
      { id: "customer_email_send" },
      { id: "calendar_scheduling" },
      { id: "knowledge_consult" },
      { id: "outbound_approvals" },
      { id: "sports_registration_golden_path" },
      { id: "sms_send" },
      { id: "meta_lead_intake" },
      { id: "website_forms" },
      { id: "voice_calls" },
    ],
    ["ai_receptionist", "crm_automation"],
  );
  assert.deepEqual(
    missions.map((m) => m.id).sort(),
    [
      "customer_email_send",
      "knowledge_consult",
      "outbound_approvals",
      "voice_calls",
      "website_forms",
    ].sort(),
  );
  assert.ok(!missions.some((m) => m.id === "meta_lead_intake"));
  assert.ok(!missions.some((m) => m.id === "sports_registration_golden_path"));
  assert.ok(!missions.some((m) => m.id === "calendar_scheduling"));
});

test("launch path label comes from packages or industry — never a hardcoded Sports-only map", () => {
  assert.equal(
    presentLaunchPathLabel({ purchasedPackages: ["ai_receptionist", "crm_automation"] }),
    "Receptionist · CRM",
  );
  assert.equal(
    presentLaunchPathLabel({ purchasedPackages: [], industry: "landscaping" }),
    "Landscaping",
  );
  assert.equal(
    presentLaunchPathLabel({ purchasedPackages: [], industry: "other" }),
    null,
  );
});

test("receptionist + CRM canonical nav excludes calendar team", () => {
  const nav = filterCanonicalNavForPurchasedPackages(
    [
      { id: "home" },
      { id: "needs_attention" },
      { id: "calendar" },
      { id: "people" },
      { id: "pipelines" },
      { id: "work" },
      { id: "team" },
      { id: "automations" },
      { id: "integrations" },
      { id: "settings" },
    ],
    ["ai_receptionist", "crm_automation"],
  );
  const ids = nav.map((item) => item.id);
  assert.ok(ids.includes("people"));
  assert.ok(ids.includes("pipelines"));
  assert.ok(ids.includes("integrations"));
  assert.ok(ids.includes("automations"));
  assert.equal(ids.includes("calendar"), false);
  assert.equal(ids.includes("team"), false);
  assert.ok(resolveCanonicalNavIdsForPackages(["ai_receptionist"]).has("people"));
});

test("module aliases keep sports players when people is entitled", () => {
  const modules = filterModulesForPurchasedPackages(
    [
      { moduleId: "home" },
      { moduleId: "players" },
      { moduleId: "teams" },
      { moduleId: "schedule" },
      { moduleId: "digital_workforce" },
      { moduleId: "knowledge" },
    ],
    ["ai_receptionist", "crm_automation"],
  );
  assert.deepEqual(
    modules.map((m) => m.moduleId).sort(),
    ["home", "knowledge", "players"].sort(),
  );
});

test("employee filter never falls back to first N for thin SKUs", () => {
  const kept = filterEmployeesForPurchasedPackages(
    [
      { employeeId: "coach", label: "Head Coach" },
      { employeeId: "scout", label: "Scout" },
      { employeeId: "fund", label: "Fundraiser" },
    ],
    ["ai_receptionist", "crm_automation"],
  );
  // Must not keep unrelated pack roles; receptionist SKU injects a front-desk default.
  assert.ok(!kept.some((row) => ["coach", "scout", "fund"].includes(String(row.employeeId))));
  assert.equal(kept.length, 1);
  assert.match(String(kept[0].label ?? ""), /Front Desk|Follow-up/i);
});

test("essential_managed injects default workers when pack would be empty", () => {
  const kept = filterEmployeesForPurchasedPackages([], ["essential_managed"]);
  assert.ok(kept.length >= 1);
  assert.ok(kept.every((row) => row.activateOnInstall === true || row.packDefault === true));
});

test("growth_managed has explicit launch missions not Meta or sports golden path", () => {
  const scope = resolvePurchasedPackageScope(["growth_managed"]);
  assert.equal(scope.fullOs, false);
  assert.ok(scope.launchMissionIds);
  assert.equal(scope.launchMissionIds.has("meta_lead_intake"), false);
  assert.equal(scope.launchMissionIds.has("sports_registration_golden_path"), false);
  assert.ok(scope.launchMissionIds.has("customer_email_send"));
});

test("receptionist and CRM discovery topics include integrations", () => {
  const scope = resolvePurchasedPackageScope(["ai_receptionist", "crm_automation"]);
  assert.ok(scope.topics.has("integrations"));
  assert.ok(scope.moduleIds.has("pipelines"));
});

test("applyPurchasedPackagesChange sets pending Ask only for newly added packages", () => {
  const withPending = applyPurchasedPackagesChange(
    { purchasedPackages: ["ai_receptionist"] },
    ["ai_receptionist", "scheduling"],
  );
  assert.deepEqual(withPending.purchasedPackages, ["ai_receptionist", "scheduling"]);
  assert.deepEqual(readPendingPackageAsk(withPending)?.packages, ["scheduling"]);

  const removalOnly = applyPurchasedPackagesChange(
    withPending,
    ["ai_receptionist"],
  );
  assert.equal(readPendingPackageAsk(removalOnly), null);
  assert.deepEqual(removalOnly.purchasedPackages, ["ai_receptionist"]);

  const cleared = clearPendingPackageAsk(withPending);
  assert.equal(readPendingPackageAsk(cleared), null);
  assert.deepEqual(cleared.purchasedPackages, ["ai_receptionist", "scheduling"]);
});

test("package Ask focuses on catalog question IDs for scheduling", async () => {
  const {
    questionMatchesPackageAsk,
    resolvePackageAskQuestionIds,
    resolvePackageAskConnectionOptions,
    specializePackageAskQuestion,
  } = await import("./SalesPackageCatalog.js");
  const focus = resolvePackageAskQuestionIds(["scheduling"]);
  assert.ok(focus.has("q_scheduling"));
  assert.ok(focus.has("q_integrations"));
  assert.equal(
    questionMatchesPackageAsk(
      { questionId: "q_scheduling", topic: "operations" },
      ["scheduling"],
      { packageAsk: true },
    ),
    true,
  );
  assert.equal(
    questionMatchesPackageAsk(
      { questionId: "q_tell_us", topic: "identity" },
      ["scheduling"],
      { packageAsk: true },
    ),
    false,
  );
  assert.deepEqual(
    resolvePackageAskConnectionOptions(["scheduling"]),
    ["google_calendar", "none_yet"],
  );
  const specialized = specializePackageAskQuestion(
    {
      questionId: "q_integrations",
      prompt: "Which accounts will you connect so VIBETech can operate for you?",
      options: ["gmail", "google_calendar", "meta_platform", "none_yet"],
    },
    { packageAsk: true, packageAskPackages: ["scheduling"] },
  );
  assert.deepEqual(specialized.options, ["google_calendar", "none_yet"]);
  assert.equal(specialized.answerType, "choice");
  assert.match(specialized.prompt, /Should Scheduling automation use Google Calendar/i);
  assert.equal(specialized.optionLabels?.google_calendar, "Yes — connect Google Calendar");
  assert.equal(specialized.optionLabels?.none_yet, "Not now");

  const {
    seedIntegrationsAnswerIfAlreadyConnected,
    specializePackageAskQuestion: specializeAgain,
  } = await import("./SalesPackageCatalog.js");
  const already = seedIntegrationsAnswerIfAlreadyConnected({
    packageAskPackages: ["scheduling"],
    connectedConnectionIds: ["calendar"],
  });
  assert.equal(already?.questionId, "q_integrations");
  assert.equal(already?.answer, "google_calendar");
  const skipped = specializeAgain(
    {
      questionId: "q_integrations",
      prompt: "Which accounts?",
      options: ["google_calendar", "none_yet"],
    },
    {
      packageAsk: true,
      packageAskPackages: ["scheduling"],
      connectedConnectionIds: ["calendar"],
    },
  );
  assert.equal(skipped.skipBecauseConnected, true);
});

test("sellable admin list hides roadmap voice family", () => {
  const sellable = listSellableSalesPackagesForAdmin();
  assert.ok(sellable.every((row) => row.sellable !== false));
  assert.ok(!sellable.some((row) => row.id === "voice_outbound_agent"));
  assert.ok(sellable.some((row) => row.id === "ai_receptionist"));
  assert.ok(sellable.some((row) => row.id === "addon_priority_support"));
});

test("sales_assistant guarantees a default worker when none match", () => {
  const kept = filterEmployeesForPurchasedPackages([], ["sales_assistant"]);
  assert.equal(kept.length, 1);
  assert.match(String(kept[0].label ?? ""), /Sales Assistant/i);
  assert.ok(kept[0].operatingContract?.automationPath?.steps?.length >= 1);
});

test("lead_follow_up guarantees a default follow-up worker", () => {
  const kept = filterEmployeesForPurchasedPackages([], ["lead_follow_up"]);
  assert.equal(kept.length, 1);
  assert.match(String(kept[0].label ?? ""), /Lead Follow-up/i);
  assert.ok(
    (kept[0].operatingContract?.trigger?.eventTypes ?? []).includes("FORM_SUBMIT"),
  );
});

test("essential managed soft caps resolve", () => {
  const caps = resolvePackageSoftCaps(["essential_managed"]);
  assert.equal(caps.maxWorkers, 3);
  assert.equal(caps.maxWorkflows, 5);
});

test("email marketing nav includes inbox and campaigns", () => {
  const nav = resolveCanonicalNavIdsForPackages(["email_sms_marketing"]);
  assert.ok(nav.has("inbox"));
  assert.ok(nav.has("campaigns"));
});

test("essential managed soft-caps workflows", () => {
  const workflows = Array.from({ length: 8 }, (_, i) => ({ id: `wf_${i}` }));
  const capped = filterWorkflowsForPurchasedPackages(workflows, ["essential_managed"]);
  assert.equal(capped.length, 5);
});

test("website lead capture honesty stays forms until native chat", () => {
  const pkg = listSellableSalesPackagesForAdmin().find((row) => row.id === "website_chatbot");
  assert.ok(pkg);
  assert.match(pkg.label, /form/i);
  assert.match(String(pkg.honestyNote ?? ""), /Forms|form/i);
});
