import { OUTCOME_CREATES_WORK_TEMPLATE } from "../../automations/templates/AutomationTemplateRegistry.js";
import { installAutomationTemplate } from "../../automations/templates/AutomationTemplateInstaller.js";

function fail(message) {
  throw new Error(`installPackageAutomations: ${message}`);
}

export function installPackageAutomations({
  automationConfigurations,
  automationRuntime,
  configurationOverrides,
  nowISO,
  installedAutomationIds = [],
} = {}) {
  if (!automationRuntime || typeof automationRuntime.applyEvent !== "function") {
    fail("automationRuntime required.");
  }

  const defs = Array.isArray(automationConfigurations) ? automationConfigurations : [];
  const overrides = configurationOverrides && typeof configurationOverrides === "object" ? configurationOverrides : {};
  const installedIds = [...installedAutomationIds];
  const timestampISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");

  for (const def of defs) {
    const configId = String(def.id ?? "");
    const baseConfig = def.configuration && typeof def.configuration === "object" ? def.configuration : {};
    const mergedConfig = { ...baseConfig, ...(overrides[configId] ?? {}) };

    const result = installAutomationTemplate({
      template: OUTCOME_CREATES_WORK_TEMPLATE,
      configuration: mergedConfig,
      automationRuntime,
      nowISO: timestampISO,
    });

    const automationId = String(result.automationId);
    if (!installedIds.includes(automationId)) installedIds.push(automationId);
  }

  return { automationIds: installedIds, automationConfigurationIds: defs.map((d) => String(d.id)) };
}
