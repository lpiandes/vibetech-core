"use client";

import { cockpitColors, spacing } from "@/design/tokens";
import {
  resolveOwnerSetupForm,
} from "../../../backend/core/integrations/ownerSetup/resolveOwnerSetupRequest.js";

const fieldLabelStyle = {
  display: "grid",
  gap: 4,
  fontSize: 13,
  fontWeight: 700,
  color: cockpitColors.textPrimary,
} as const;

const fieldHintStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: cockpitColors.textMuted,
  lineHeight: 1.4,
} as const;

const fieldInputStyle = {
  padding: 8,
  borderRadius: 6,
  border: `1px solid ${cockpitColors.panelBorder}`,
  fontWeight: 500,
  background: cockpitColors.panel,
  color: cockpitColors.textPrimary,
} as const;

/**
 * Registry-driven owner input fields for white-glove Request setup.
 * Shows hand-holding howTo only when the owner must take action.
 */
export default function OwnerSetupFields({
  connectionId,
  values,
  onChange,
  missing = [],
}: {
  connectionId: string;
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  missing?: string[];
}) {
  const form = resolveOwnerSetupForm(connectionId);
  const missingSet = new Set(missing);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: cockpitColors.textPrimary }}>
        We set this up for you
      </div>
      <p style={{ margin: 0, fontSize: 13, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
        {form.intro}
      </p>

      {form.fields.map((field) => {
        const value = values[field.id] ?? "";
        const showHowTo = Array.isArray(field.howTo) && field.howTo.length > 0;
        const isMissing = missingSet.has(field.id);
        const inputType = field.input === "textarea" ? undefined : field.input === "tel" ? "tel" : field.input === "email" ? "email" : field.input === "url" ? "url" : "text";

        return (
          <label key={field.id} style={fieldLabelStyle}>
            {field.label}
            {field.required ? (
              <span style={{ ...fieldHintStyle, color: isMissing ? "#b91c1c" : fieldHintStyle.color }}>
                Required{field.hint ? ` — ${field.hint}` : ""}
              </span>
            ) : field.hint ? (
              <span style={fieldHintStyle}>{field.hint}</span>
            ) : null}

            {showHowTo ? (
              <ol
                style={{
                  margin: "4px 0 0",
                  paddingLeft: 18,
                  fontSize: 12,
                  fontWeight: 500,
                  color: cockpitColors.textSecondary,
                  lineHeight: 1.45,
                }}
              >
                {field.howTo.map((step, i) => (
                  <li key={`${field.id}_how_${i}`}>{step}</li>
                ))}
              </ol>
            ) : null}

            {field.input === "textarea" ? (
              <textarea
                placeholder={field.placeholder ?? ""}
                value={value}
                onChange={(e) => onChange(field.id, e.target.value)}
                rows={3}
                style={{
                  ...fieldInputStyle,
                  resize: "vertical" as const,
                  borderColor: isMissing ? "#b91c1c" : cockpitColors.panelBorder,
                }}
              />
            ) : (
              <input
                type={inputType}
                placeholder={field.placeholder ?? ""}
                value={value}
                onChange={(e) => onChange(field.id, e.target.value)}
                style={{
                  ...fieldInputStyle,
                  borderColor: isMissing ? "#b91c1c" : cockpitColors.panelBorder,
                }}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

export function emptyOwnerSetupValues(connectionId: string): Record<string, string> {
  const form = resolveOwnerSetupForm(connectionId);
  const out: Record<string, string> = {};
  for (const field of form.fields) out[field.id] = "";
  return out;
}
