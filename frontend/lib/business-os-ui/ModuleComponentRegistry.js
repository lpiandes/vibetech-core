/** Registered module presentation components — no arbitrary JSX. */
export const MODULE_COMPONENT_TYPES = Object.freeze([
  "records_list",
  "work_queue",
  "timeline",
  "calendar",
  "form",
  "metrics",
  "setup_card",
  "knowledge_list",
  "communications",
  "team",
  "performance",
  "home",
  "subjects",
  "people",
]);

export function isRegisteredModuleComponent(type) {
  return MODULE_COMPONENT_TYPES.includes(String(type));
}

export function resolveModuleComponent(type) {
  if (!isRegisteredModuleComponent(type)) return null;
  return { type: String(type), allowed: true };
}
