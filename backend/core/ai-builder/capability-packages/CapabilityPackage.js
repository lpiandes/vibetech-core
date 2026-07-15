import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Capability Package contract — every shippable Ask/OS feature implements this shape.
 * Packages declare setup honesty: available | needs_setup | not_yet.
 */

export const CAPABILITY_PACKAGE_AVAILABILITY = Object.freeze([
  "available",
  "needs_setup",
  "not_yet",
]);

export function createCapabilityPackage(input = {}) {
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("CapabilityPackage: id required.");
  const availability = String(input.availability ?? "not_yet");
  if (!CAPABILITY_PACKAGE_AVAILABILITY.includes(availability)) {
    throw new Error(`CapabilityPackage: invalid availability ${availability}`);
  }

  return deepFreeze({
    id,
    label: String(input.label ?? id),
    description: String(input.description ?? ""),
    industries: deepFreeze((input.industries ?? []).map(String)),
    availability,
    setupRequirements: deepFreeze((input.setupRequirements ?? []).map(String)),
    discoveryTopics: deepFreeze((input.discoveryTopics ?? []).map(String)),
    askCapabilityIds: deepFreeze((input.askCapabilityIds ?? []).map(String)),
    workTypes: deepFreeze((input.workTypes ?? []).map(String)),
    modules: deepFreeze((input.modules ?? []).map(String)),
    employeeArchetypes: deepFreeze((input.employeeArchetypes ?? []).map(String)),
    ownerPromise: String(input.ownerPromise ?? ""),
    neverSilentSend: input.neverSilentSend !== false,
    version: String(input.version ?? "1.0.0"),
  });
}

/**
 * Honesty map for owners/admins — what Ask can do today.
 */
export function presentCapabilityHonestyMatrix(packages = []) {
  return deepFreeze(packages.map((pkg) => ({
    id: pkg.id,
    label: pkg.label,
    status: pkg.availability,
    statusLabel:
      pkg.availability === "available"
        ? "Available after you approve"
        : pkg.availability === "needs_setup"
          ? "Needs a connection first"
          : "Not available yet",
    industries: pkg.industries,
    setupRequirements: pkg.setupRequirements,
    ownerPromise: pkg.ownerPromise,
    neverSilentSend: pkg.neverSilentSend,
  })));
}
