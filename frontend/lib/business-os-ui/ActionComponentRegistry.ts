export const ACTION_COMPONENT_TYPES = [
  "primary_button",
  "secondary_button",
  "approve_reject",
  "request_access",
  "open_work",
  "setup_connection",
] as const;

export function isRegisteredActionComponent(type: string) {
  return (ACTION_COMPONENT_TYPES as readonly string[]).includes(type);
}
