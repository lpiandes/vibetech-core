/**
 * Deterministic business-facing date formatting. Never returns "Invalid Date".
 */
export function formatBusinessDate(iso, { nowISO } = {}) {
  if (!iso) return null;
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatBusinessDateWithOverdue(iso, { nowISO } = {}) {
  const label = formatBusinessDate(iso, { nowISO });
  if (!label) return { label: null, overdue: false };
  const due = new Date(String(iso)).getTime();
  const now = new Date(String(nowISO ?? Date.now())).getTime();
  const overdue = !Number.isNaN(due) && due < now;
  return { label, overdue };
}
