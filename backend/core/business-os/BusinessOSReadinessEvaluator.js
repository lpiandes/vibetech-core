import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Evaluates whether a compiled plan is ready for dry-run / install.
 */
export function evaluateBusinessOSInstallReadiness({ specification, plan, dryRunCompleted = false, approved = false } = {}) {
  const blocking = [];
  const warnings = [];

  if (!specification) blocking.push({ code: "specification_missing", message: "A business operating system proposal is required." });
  if (!plan) blocking.push({ code: "plan_missing", message: "An installation plan is required." });

  const prohibited = asArray(plan?.capabilityResolutions).filter((entry) => entry.prohibited);
  if (prohibited.length) {
    blocking.push({ code: "prohibited_capability", message: "A requested capability is not allowed." });
  }

  const missingPlatform = asArray(plan?.actions).filter((action) => action.type === "REQUIRE_PLATFORM_CAPABILITY");
  if (missingPlatform.length) {
    warnings.push({
      code: "platform_capability_gaps",
      message: `${missingPlatform.length} requested outcome(s) need reusable platform development.`,
    });
  }

  const setup = asArray(plan?.actions).filter((action) => action.requiresSetup || action.type === "REQUIRE_SETUP");
  if (setup.length) {
    warnings.push({
      code: "setup_required",
      message: `${setup.length} item(s) need connection or configuration after install.`,
    });
  }

  if (!dryRunCompleted && approved) {
    blocking.push({ code: "dry_run_required", message: "Complete a dry run before approval and install." });
  }

  let state = "not_ready";
  if (blocking.length === 0) {
    state = dryRunCompleted
      ? (approved ? "ready_to_install" : "ready_to_approve")
      : "ready_for_dry_run";
  }

  return deepFreeze({
    state,
    ok: blocking.length === 0,
    blocking,
    warnings,
    deferredCount: asArray(plan?.actions).filter((action) => action.deferred).length,
    setupRequiredCount: setup.length,
    unresolvedQuestionCount: asArray(plan?.unresolvedQuestions).length,
  });
}
