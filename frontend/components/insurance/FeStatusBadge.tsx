import { formatFePolicyStatus } from "../../../backend/core/fe-retention/FeRetentionLabels.js";

export function FeStatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const key = String(status || "active").toLowerCase();
  const text = label || formatFePolicyStatus(key);
  return (
    <span className={`fe-badge fe-badge--${key}`}>
      <span className="fe-badge-dot" aria-hidden />
      {text}
    </span>
  );
}
