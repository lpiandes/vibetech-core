export const ACTION_COMPONENT_TYPES = Object.freeze([
  "primary_button",
  "secondary_button",
  "approve_reject",
  "request_access",
  "open_work",
  "setup_connection",
]);

export function isRegisteredActionComponent(type) {
  return ACTION_COMPONENT_TYPES.includes(String(type));
}
