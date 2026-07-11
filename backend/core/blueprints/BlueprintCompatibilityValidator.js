import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function issue(severity, code, message) {
  return deepFreeze({ severity, code, message });
}

/**
 * Validates blueprint compatibility with capability registry and migration rules.
 */
export function validateBlueprintCompatibility(blueprint, {
  capabilityRegistry = null,
  targetSchemaVersion = 1,
} = {}) {
  const errors = [];
  const warnings = [];

  if (!blueprint?.blueprintId) {
    errors.push(issue("error", "blueprint_id_required", "blueprintId is required."));
  }
  if (!blueprint?.industry) {
    errors.push(issue("error", "industry_required", "industry is required."));
  }

  const required = asArray(blueprint?.requiredCapabilities).map((entry) => (
    typeof entry === "string" ? entry : entry.capabilityId ?? entry.id
  ));
  const supported = new Set(asArray(blueprint?.supportedCapabilities).map((entry) => (
    typeof entry === "string" ? entry : entry.capabilityId ?? entry.id
  )));

  for (const capabilityId of required) {
    if (!supported.has(capabilityId)) {
      warnings.push(issue(
        "warning",
        "required_not_listed_supported",
        `Required capability ${capabilityId} is not listed in supportedCapabilities.`,
      ));
    }
    if (capabilityRegistry) {
      const resolved = capabilityRegistry.resolve?.(capabilityId)
        ?? capabilityRegistry.resolvePackageFeature?.(capabilityId)
        ?? null;
      if (!resolved) {
        errors.push(issue("error", "unknown_capability", `Unknown required capability: ${capabilityId}`));
      } else if (resolved.availability === "prohibited") {
        errors.push(issue("error", "prohibited_capability", `Prohibited capability: ${capabilityId}`));
      }
    }
  }

  const compat = blueprint?.migrationCompatibility ?? {};
  const minSchema = Number(compat.minSchemaVersion ?? 1);
  const maxSchema = Number(compat.maxSchemaVersion ?? targetSchemaVersion);
  if (targetSchemaVersion < minSchema || targetSchemaVersion > maxSchema) {
    errors.push(issue(
      "error",
      "schema_incompatible",
      `Blueprint schema compatibility ${minSchema}-${maxSchema} does not include ${targetSchemaVersion}.`,
    ));
  }

  if (blueprint?.goldStatus && blueprint?.source !== "gold" && blueprint?.source !== "package") {
    warnings.push(issue(
      "warning",
      "gold_source_unexpected",
      "Gold blueprints should originate from package or gold sources.",
    ));
  }

  return deepFreeze({
    ok: errors.length === 0,
    errors,
    warnings,
  });
}
