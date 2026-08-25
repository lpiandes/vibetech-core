import { formatFePolicyStatus } from "../../../backend/core/fe-retention/FeRetentionLabels.js";

export function FeStatusBadge({
  status,
  label,
  size = "md",
  pop = false,
}: {
  status: string;
  label?: string;
  size?: "md" | "lg";
  pop?: boolean;
}) {
  const key = String(status || "active").toLowerCase();
  const text = label || formatFePolicyStatus(key);
  const popClass = pop ? " fe-badge--pop" : "";

  if (size === "lg") {
    return (
      <span
        className={`fe-badge fe-badge--${key} fe-badge--lg fe-badge--solo fe-badge--header${popClass}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 20px",
          minWidth: "6.25rem",
          minHeight: "2.5rem",
          borderRadius: "999px",
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        {text}
      </span>
    );
  }

  return (
    <span className={`fe-badge fe-badge--${key} fe-badge--${size}`}>
      <span className="fe-badge-dot" aria-hidden />
      <span className="fe-badge-text">{text}</span>
    </span>
  );
}
