export const REQUEST_STATUSES = ["received", "reviewing", "qualified", "rejected", "converted", "cancelled", "closed"];

export function isValidRequestStatus(status) {
  return REQUEST_STATUSES.includes(String(status ?? ""));
}

