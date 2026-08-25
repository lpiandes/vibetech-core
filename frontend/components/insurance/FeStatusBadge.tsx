import { formatFePolicyStatus } from "../../../backend/core/fe-retention/FeRetentionLabels.js";

export function FeStatusBadge({
  status,
  label,
  size = "md",
}: {
  status: string;
  label?: string;
  size?: "md" | "lg";
}) {
  const key = String(status || "active").toLowerCase();
  const text = label || formatFePolicyStatus(key);
  return (
    <span className={`fe-badge fe-badge--${key} fe-badge--${size}`}>
      <span className="fe-badge-dot" aria-hidden />
      <span className="fe-badge-text">{text}</span>
    </span>
  );
}
