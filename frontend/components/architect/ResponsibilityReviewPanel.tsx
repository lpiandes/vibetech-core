"use client";

import { useMemo, useState } from "react";
import { ArchitectButton } from "./ArchitectPrimitives";
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
  onCancelEdit?: () => void;
};

const MODE_LABELS: Record<string, string> = {
  ready_existing_capabilities: "Ready to configure",
  ready_after_customer_access: "Needs your action",
  ready_after_business_rules: "Needs clarification",
  operator_assisted: "VIBETech-operated",
  requires_reusable_capability: "VIBETech capability required",
  unsupported_or_unsafe: "Cannot be installed as requested",
};

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
    <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, color: architect.textPrimary }}>
          Here is what you want VIBETech to operate
        </h2>
        <p style={{ margin: "8px 0 0", color: architect.textSecondary, fontSize: 14, lineHeight: 1.45 }}>
          Confirm this inventory before we ask implementation questions. You can edit, remove, or add.
        </p>
      </div>

      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
        {visible.map((item, index) => {
          const modeLabel = MODE_LABELS[String(item.implementationMode ?? "")] ?? null;
          const editing = editingId === item.responsibilityId;
          return (
            <li
              key={item.responsibilityId}
              style={{
                border: `1px solid ${architect.border}`,
                borderRadius: 12,
                padding: 14,
                background: architect.panel,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: architect.textMuted, marginBottom: 4 }}>
                    {index + 1}.
                    {modeLabel ? ` · ${modeLabel}` : ""}
                  </div>
                  {editing ? (
                    <input
                      value={item.title ?? ""}
                      onChange={(e) => updateTitle(item.responsibilityId, e.target.value)}
                      style={{
                        width: "100%",
                        fontSize: 16,
                        fontWeight: 700,
                        marginBottom: 8,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: `1px solid ${architect.border}`,
                        background: architect.inputBg ?? "#0b1218",
                        color: architect.textPrimary,
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 700, color: architect.textPrimary }}>
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
                        padding: 8,
                        borderRadius: 8,
                        border: `1px solid ${architect.border}`,
                        background: architect.inputBg ?? "#0b1218",
                        color: architect.textPrimary,
                        resize: "vertical",
                      }}
                    />
                  ) : (
                    <p style={{ margin: "6px 0 0", fontSize: 14, color: architect.textSecondary, lineHeight: 1.45 }}>
                      {item.requestedOutcome || item.rawRequest}
                    </p>
                  )}
                  {Array.isArray(item.constraints) && item.constraints.length > 0 ? (
                    <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: architect.textMuted, fontSize: 12 }}>
                      {item.constraints.slice(0, 3).map((c, i) => (
                        <li key={`${item.responsibilityId}_c_${i}`}>{c.description || c.type}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
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
                    variant="ghost"
                    disabled={busy}
                    onClick={() => removeItem(item.responsibilityId)}
                  >
                    Remove
                  </ArchitectButton>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <ArchitectButton type="button" variant="primary" disabled={busy || visible.length === 0} onClick={() => onConfirm(visible)}>
          That&apos;s correct
        </ArchitectButton>
        <ArchitectButton type="button" variant="secondary" disabled={busy} onClick={addBlank}>
          Add responsibility
        </ArchitectButton>
      </div>
    </div>
  );
}
