import { CAPABILITY_EVENT_TYPES } from "../../capabilities/runtime/CapabilityEventTypes.js";
import { createCapability } from "../../capabilities/runtime/Capability.js";

function fail(message) {
  throw new Error(`installPackageCapabilities: ${message}`);
}

export function installPackageCapabilities({
  capabilities,
  capabilityRuntime,
  nowISO,
  installedCapabilityIds = [],
} = {}) {
  if (!capabilityRuntime || typeof capabilityRuntime.applyEvent !== "function") {
    fail("capabilityRuntime required.");
  }

  const defs = Array.isArray(capabilities) ? capabilities : [];
  const installedIds = [...installedCapabilityIds];
  const timestampISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");

  for (const def of defs) {
    const capId = String(def.id ?? "");
    if (!capId) continue;
    if (capabilityRuntime.getCapability(capId)) {
      if (!installedIds.includes(capId)) installedIds.push(capId);
      continue;
    }

    const capability = createCapability({
      id: capId,
      name: String(def.name ?? capId),
      description: String(def.description ?? ""),
      category: String(def.category ?? "operations"),
      level: def.level ?? 3,
      status: "active",
      requirements: Array.isArray(def.requirements) ? def.requirements : [],
      providedBy: Array.isArray(def.providedBy) ? def.providedBy : ["human", "digital_employee"],
      requiredKnowledge: Array.isArray(def.requiredKnowledge) ? def.requiredKnowledge : [],
      requiredConnectedSystems: Array.isArray(def.requiredConnectedSystems) ? def.requiredConnectedSystems : [],
      metadata: def.metadata && typeof def.metadata === "object" ? def.metadata : { derivedFrom: { industryPackage: true } },
    });

    capabilityRuntime.applyEvent({
      id: `evt_cap_registered_${capId}_${timestampISO}`,
      timestampISO,
      source: "industry_package_installer",
      type: CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED,
      payload: { capability },
    });
    installedIds.push(capId);
  }

  return { capabilityIds: installedIds };
}
