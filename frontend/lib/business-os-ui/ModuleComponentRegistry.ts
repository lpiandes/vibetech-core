/** Registered module presentation components — no arbitrary JSX. */
export const MODULE_COMPONENT_TYPES = [
  "records_list",
  "work_queue",
  "timeline",
  "calendar",
  "form",
  "metrics",
  "setup_card",
  "knowledge_list",
] as const;

export type ModuleComponentType = (typeof MODULE_COMPONENT_TYPES)[number];

export function isRegisteredModuleComponent(type: string): type is ModuleComponentType {
  return (MODULE_COMPONENT_TYPES as readonly string[]).includes(type);
}

export function resolveModuleComponent(type: string) {
  if (!isRegisteredModuleComponent(type)) return null;
  return { type, allowed: true };
}
