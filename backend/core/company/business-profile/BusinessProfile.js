function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

export function createBusinessProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw new Error("createBusinessProfile: profile object required.");
  }
  return deepFreeze(profile);
}

