"use client";

import { useRef, type CSSProperties } from "react";

import {
  MESSAGE_PERSONALIZATION_CHIPS,
  previewMessagePersonalization,
} from "../../../backend/core/ai-builder/specialty/resolveMessagePersonalization.js";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  style?: CSSProperties;
  disabled?: boolean;
  /** Show a filled preview under the textarea. */
  showPreview?: boolean;
};

/**
 * Plain message box + chip buttons. Owners never type contact.name.
 */
export default function MessagePersonalizationField({
  value,
  onChange,
  placeholder,
  rows = 4,
  style,
  disabled,
  showPreview = true,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function insertToken(chip: (typeof MESSAGE_PERSONALIZATION_CHIPS)[number]) {
    const insert = "insert" in chip && chip.insert ? chip.insert : chip.token;
    const el = ref.current;
    if (!el) {
      onChange(`${value}${value && !value.endsWith("\n") ? "\n" : ""}${insert}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + insert.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  const preview = showPreview && value.trim()
    ? previewMessagePersonalization(value)
    : "";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span style={{
          fontSize: 12,
          color: "#64748b",
          alignSelf: "center",
          marginRight: 2,
        }}>
          Insert
        </span>
        {MESSAGE_PERSONALIZATION_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={disabled}
            onClick={() => insertToken(chip)}
            style={{
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              color: "#0f172a",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: disabled ? "default" : "pointer",
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        style={style}
      />
      <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
        Tap a chip to drop it in — we’ll fill Name, Phone, and Email when the lead arrives.
      </p>
      {preview ? (
        <div style={{
          borderRadius: 10,
          border: "1px dashed #cbd5e1",
          background: "#f8fafc",
          padding: "10px 12px",
          fontSize: 13,
          color: "#334155",
          whiteSpace: "pre-wrap",
          lineHeight: 1.45,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Preview with sample lead
          </div>
          {preview}
        </div>
      ) : null}
    </div>
  );
}
