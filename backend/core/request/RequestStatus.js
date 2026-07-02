export const REQUEST_STATUSES = [
  "support",
  "received",
  "reviewing",
  "qualified",
  "rejected",
  "converted",
  "cancelled",
  "closed",
];

export function isValidRequestStatus(value) {
  return REQUEST_STATUSES.includes(String(value));
}

