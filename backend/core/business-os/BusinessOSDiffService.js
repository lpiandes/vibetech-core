import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createHash } from "node:crypto";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Diff two specifications / installation plans for upgrades.
 */
export function diffBusinessOSSpecifications({ previous, next } = {}) {
  if (!previous) {
    return deepFreeze({
      kind: "initial_install",
      changed: true,
      addedModules: asArray(next?.modules).map((module) => module.moduleId),
      removedModules: [],
      changedModules: [],
      addedCapabilities: asArray(next?.capabilityRequirements).map((entry) => entry.capabilityId ?? entry.id),
      removedCapabilities: [],
      contentHashChanged: true,
    });
  }

  const prevModules = new Set(asArray(previous.modules).map((module) => module.moduleId));
  const nextModules = new Set(asArray(next.modules).map((module) => module.moduleId));
  const prevCaps = new Set(asArray(previous.capabilityRequirements).map((entry) => entry.capabilityId ?? entry.id));
  const nextCaps = new Set(asArray(next.capabilityRequirements).map((entry) => entry.capabilityId ?? entry.id));

  const addedModules = [...nextModules].filter((id) => !prevModules.has(id));
  const removedModules = [...prevModules].filter((id) => !nextModules.has(id));
  const changedModules = asArray(next.modules)
    .filter((module) => prevModules.has(module.moduleId))
    .filter((module) => {
      const prior = asArray(previous.modules).find((entry) => entry.moduleId === module.moduleId);
      return JSON.stringify(prior) !== JSON.stringify(module);
    })
    .map((module) => module.moduleId);

  return deepFreeze({
    kind: "upgrade",
    changed: previous.contentHash !== next.contentHash,
    addedModules,
    removedModules,
    changedModules,
    addedCapabilities: [...nextCaps].filter((id) => !prevCaps.has(id)),
    removedCapabilities: [...prevCaps].filter((id) => !nextCaps.has(id)),
    contentHashChanged: previous.contentHash !== next.contentHash,
  });
}

export function diffInstallationPlans({ previousPlan, nextPlan } = {}) {
  const prevIds = new Set(asArray(previousPlan?.actions).map((action) => action.actionId));
  const nextActions = asArray(nextPlan?.actions);
  return deepFreeze({
    addedActions: nextActions.filter((action) => !prevIds.has(action.actionId)),
    unchangedActionIds: nextActions.filter((action) => prevIds.has(action.actionId)).map((action) => action.actionId),
    removedActionIds: [...prevIds].filter((id) => !nextActions.some((action) => action.actionId === id)),
    planFingerprint: createHash("sha256")
      .update(JSON.stringify(nextActions.map((action) => action.actionId)))
      .digest("hex"),
  });
}
