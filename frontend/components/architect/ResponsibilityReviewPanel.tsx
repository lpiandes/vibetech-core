"use client";

import { useMemo, useState } from "react";
import { ArchitectButton, ArchitectPanel } from "./ArchitectPrimitives";
import { architect } from "./architectTheme";

type Responsibility = {
  responsibilityId: string;
  title?: string;
  rawRequest?: string;
  requestedOutcome?: string;
  implementationMode?: string | null;
  constraints?: Array<{ description?: string; type?: string; owner?: string }>;
  status?: string;
  confidence?: number | null;
};

type Props = {
  responsibilities?: Responsibility[];
  busy?: boolean;
  onConfirm: (responsibilities: Responsibility[]) => Promise<void> | void;
};

const MODE_META: Record<string, { label: string; tone: "ok" | "action" | "warn" | "blocked" | "work" }> = {
  ready_existing_capabilities: { label: "Ready to configure", tone: "ok" },
  ready_after_customer_access: { label: "Needs your action", tone: "action" },
  ready_after_business_rules: { label: "Needs clarification", tone: "warn" },
  operator_assisted: { label: "VIBETech-operated", tone: "work" },
  requires_reusable_capability: { label: "VIBETech capability required", tone: "work" },
  unsupported_or_unsafe: { label: "Cannot be installed as requested", tone: "blocked" },
};

function toneStyles(tone: string) {
  switch (tone) {
    case "ok":
      return { color: architect.success, bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.28)" };
    case "action":
      return { color: architect.accent, bg: architect.accentSoft, border: architect.borderGlow };
    case "warn":
      return { color: architect.warning, bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.28)" };
    case "blocked":
      return { color: architect.danger, bg: "rgba(248, 113, 113, 0.12)", border: "rgba(248, 113, 113, 0.28)" };
    case "work":
    default:
      return { color: architect.accentSecondary, bg: "rgba(103, 232, 249, 0.08)", border: "rgba(103, 232, 249, 0.22)" };
  }
}

/**
 * After Q2 — show what VIBETech heard before any Operating Contract is generated.
 */
export default function ResponsibilityReviewPanel({
  responsibilities = [],
  busy,
  onConfirm,
}: Props) {
  const [items, setItems] = useState<Responsibility[]>(() =>
    responsibilities.filter((r) => String(r.status) !== "removed"),
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const visible = useMemo(
    () => items.filter((r) => String(r.status) !== "removed"),
    [items],
  );

  function updateTitle(id: string, title: string) {
    setItems((prev) => prev.map((r) => (r.responsibilityId === id ? { ...r, title } : r)));
  }

  function updateOutcome(id: string, requestedOutcome: string) {
    setItems((prev) => prev.map((r) => (r.responsibilityId === id ? { ...r, requestedOutcome, rawRequest: requestedOutcome } : r)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.map((r) => (r.responsibilityId === id ? { ...r, status: "removed" } : r)));
  }

  function addBlank() {
    const id = `resp_manual_${Date.now().toString(36)}`;
    setItems((prev) => [
      ...prev,
      {
        responsibilityId: id,
        title: "New responsibility",
        rawRequest: "",
        requestedOutcome: "",
        status: "pending_review",
        constraints: [],
      },
    ]);
    setEditingId(id);
  }

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 720, animation: "architectFadeUp .45s ease" }}>
      <div>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: architect.accent,
          marginBottom: 8,
        }}
        >
          Responsibility inventory
        </div>
        <h2 style={{
          margin: 0,
          fontFamily: architect.display,
          fontSize: "clamp(1.4rem, 2.8vw, 1.85rem)",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          color: architect.ink,
        }}
        >
          Here is what you want VIBETech to operate
        </h2>
        <p style={{ margin: "10px 0 0", color: architect.inkMuted, fontSize: 14, lineHeight: 1.5 }}>
          Confirm this list before we ask implementation questions. Edit, remove, or add until it matches what you meant.
        </p>
      </div>

      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
        {visible.map((item, index) => {
          const meta = MODE_META[String(item.implementationMode ?? "")] ?? null;
          const tone = toneStyles(meta?.tone ?? "work");
          const editing = editingId === item.responsibilityId;
          return (
            <li key={item.responsibilityId}>
              <ArchitectPanel
                style={{
                  padding: "18px 18px 16px",
                  borderRadius: architect.radiusSm,
                  border: `1px solid ${architect.border}`,
                  boxShadow: "none",
                  background: architect.panelSolid,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start" }}>
                  <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: architect.inkMuted,
                        fontVariantNumeric: "tabular-nums",
                      }}
                      >
                        {index + 1}
                      </span>
                      {meta ? (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          color: tone.color,
                          background: tone.bg,
                          border: `1px solid ${tone.border}`,
                          borderRadius: 999,
                          padding: "3px 9px",
                        }}
                        >
                          {meta.label}
                        </span>
                      ) : null}
                    </div>

                    {editing ? (
                      <input
                        value={item.title ?? ""}
                        onChange={(e) => updateTitle(item.responsibilityId, e.target.value)}
                        style={{
                          width: "100%",
                          fontSize: 17,
                          fontWeight: 700,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1px solid ${architect.borderGlow}`,
                          background: "rgba(7, 11, 20, 0.85)",
                          color: architect.ink,
                          fontFamily: architect.font,
                          boxSizing: "border-box",
                        }}
                      />
                    ) : (
                      <div style={{
                        fontFamily: architect.display,
                        fontSize: 18,
                        fontWeight: 600,
                        color: architect.ink,
                        letterSpacing: "-0.01em",
                      }}
                      >
                        {item.title}
                      </div>
                    )}

                    {editing ? (
                      <textarea
                        value={item.requestedOutcome || item.rawRequest || ""}
                        onChange={(e) => updateOutcome(item.responsibilityId, e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          fontSize: 14,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1px solid ${architect.border}`,
                          background: "rgba(7, 11, 20, 0.85)",
                          color: architect.ink,
                          fontFamily: architect.font,
                          resize: "vertical",
                          lineHeight: 1.45,
                          boxSizing: "border-box",
                        }}
                      />
                    ) : (
                      <p style={{ margin: 0, fontSize: 14, color: architect.inkMuted, lineHeight: 1.5 }}>
                        {item.requestedOutcome || item.rawRequest}
                      </p>
                    )}

                    {Array.isArray(item.constraints) && item.constraints.length > 0 ? (
                      <ul style={{
                        margin: "4px 0 0",
                        padding: 0,
                        listStyle: "none",
                        display: "grid",
                        gap: 6,
                      }}
                      >
                        {item.constraints.slice(0, 3).map((c, i) => (
                          <li
                            key={`${item.responsibilityId}_c_${i}`}
                            style={{
                              fontSize: 12,
                              lineHeight: 1.4,
                              color: architect.inkMuted,
                              paddingLeft: 12,
                              position: "relative",
                            }}
                          >
                            <span aria-hidden style={{ position: "absolute", left: 0, color: architect.accent }}>•</span>
                            {c.description || c.type}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: 8, flexShrink: 0 }}>
                    <ArchitectButton
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setEditingId(editing ? null : item.responsibilityId)}
                    >
                      {editing ? "Done" : "Edit"}
                    </ArchitectButton>
                    <ArchitectButton
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => removeItem(item.responsibilityId)}
                    >
                      Remove
                    </ArchitectButton>
                  </div>
                </div>
              </ArchitectPanel>
            </li>
          );
        })}
      </ol>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 4 }}>
        <ArchitectButton
          type="button"
          variant="primary"
          disabled={busy || visible.length === 0}
          onClick={() => onConfirm(visible)}
        >
          That&apos;s correct
        </ArchitectButton>
        <ArchitectButton type="button" variant="secondary" disabled={busy} onClick={addBlank}>
          Add responsibility
        </ArchitectButton>
      </div>
    </div>
  );
}
