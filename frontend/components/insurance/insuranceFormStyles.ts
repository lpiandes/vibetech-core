import { brand } from "@/design/tokens/brand";
import type { CSSProperties } from "react";

/** Shared field chrome for insurance login / signup (same tokens as InsuranceShell). */
export const insuranceFieldStyle: CSSProperties = {
  width: "100%",
  border: `1px solid ${brand.border}`,
  background: "rgba(7, 11, 22, 0.72)",
  borderRadius: 10,
  padding: "0.65rem 0.75rem",
  color: brand.text,
  fontSize: 15,
};

export const insuranceLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: brand.textMuted,
  marginBottom: 6,
};
