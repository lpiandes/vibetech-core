"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors, spacing } from "@/design/tokens";

const TRIGGER_MODES = [
  { id: "manual", label: "Manual" },
  { id: "events", label: "On events" },
  { id: "manual_or_events", label: "Manual + events" },
  { id: "schedule", label: "Schedule" },
] as const;

type ScopeRow = {
  key: string;
  label: string;
  input?: string;
  required?: boolean;
  placeholder?: string;
  answer?: { value?: string; notApplicable?: boolean; reason?: string };
  display?: string;
  missing?: boolean;
};

type ContractPresentation = {
  trigger?: { mode?: string; modeLabel?: string; summary?: string };
  executes?: { summary?: string };
  rules?: {
    customerFacingRequiresApproval?: boolean;
    connectionDependencies?: string[];
  };
  scopeRows?: ScopeRow[];
  completeness?: { complete?: boolean; missingKeys?: string[]; requiredKeys?: string[] };
  statusLabel?: string;
};

/**
 * Compact “character sheet” editor — progress bar + short fields, not a wiki.
 */
export default function OperatingContractEditor({
  businessId,
  employeeId,
  initialPresentation = null,
  onSaved,
}: {
  businessId: string;
  employeeId: string;
  initialPresentation?: ContractPresentation | null;
  onSaved?: (presentation: ContractPresentation) => void;
}) {
  const [presentation, setPresentation] = useState<ContractPresentation | null>(initialPresentation);
  const [triggerMode, setTriggerMode] = useState(String(initialPresentation?.trigger?.mode ?? "manual_or_events"));
  const [triggerSummary, setTriggerSummary] = useState(String(initialPresentation?.trigger?.summary ?? ""));
  const [executesSummary, setExecutesSummary] = useState(String(initialPresentation?.executes?.summary ?? ""));
  const [scheduleDraft, setScheduleDraft] = useState({
    cadence: "weekly",
    dayOfWeek: Number((initialPresentation?.trigger as any)?.schedule?.dayOfWeek ?? 0),
    hourLocal: Number((initialPresentation?.trigger as any)?.schedule?.hourLocal ?? 9),
    timezone: String((initialPresentation?.trigger as any)?.schedule?.timezone ?? "America/New_York"),
  });
  const [scopeDraft, setScopeDraft] = useState<Record<string, { value: string; notApplicable: boolean; reason: string }>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startEditing = !initialPresentation?.completeness?.complete;
  const [editing, setEditing] = useState(startEditing);

  useEffect(() => {
    if (initialPresentation) {
      hydrate(initialPresentation);
      if (!initialPresentation.completeness?.complete) setEditing(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/businesses/${encodeURIComponent(businessId)}/team/${encodeURIComponent(employeeId)}/operating-contract`,
        );
        const data = await res.json();
        if (cancelled || !data?.ok) return;
        hydrate(data.presentation);
        if (!data.presentation?.completeness?.complete) setEditing(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, employeeId, initialPresentation]);

  function hydrate(pres: ContractPresentation) {
    setPresentation(pres);
    setTriggerMode(String(pres.trigger?.mode ?? "manual_or_events"));
    setTriggerSummary(String(pres.trigger?.summary ?? ""));
    setExecutesSummary(String(pres.executes?.summary ?? ""));
    setScheduleDraft({
      cadence: "weekly",
      dayOfWeek: Number((pres.trigger as any)?.schedule?.dayOfWeek ?? 0),
      hourLocal: Number((pres.trigger as any)?.schedule?.hourLocal ?? 9),
      timezone: String((pres.trigger as any)?.schedule?.timezone ?? "America/New_York"),
    });
    const draft: Record<string, { value: string; notApplicable: boolean; reason: string }> = {};
    for (const row of pres.scopeRows ?? []) {
      draft[row.key] = {
        value: String(row.answer?.value ?? ""),
        notApplicable: Boolean(row.answer?.notApplicable),
        reason: String(row.answer?.reason ?? ""),
      };
    }
    setScopeDraft(draft);
  }

  const progress = useMemo(() => {
    const required = presentation?.completeness?.requiredKeys?.length
      ?? presentation?.scopeRows?.filter((r) => r.required !== false).length
      ?? 5;
    const missing = presentation?.completeness?.missingKeys?.length ?? required;
    const done = Math.max(0, required - missing);
    const pct = required ? Math.round((done / required) * 100) : 0;
    return { done, required, pct, complete: Boolean(presentation?.completeness?.complete) };
  }, [presentation]);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const answers: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(scopeDraft)) answers[key] = value;
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/team/${encodeURIComponent(employeeId)}/operating-contract`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            trigger: {
              mode: triggerMode,
              summary: triggerSummary,
              schedule: (triggerMode === "schedule" || triggerMode === "manual_or_events")
                ? scheduleDraft
                : null,
            },
            executes: { summary: executesSummary },
            scope: { answers },
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not save.");
      hydrate(data.presentation);
      const complete = Boolean(data.completeness?.complete ?? data.presentation?.completeness?.complete);
      setEditing(!complete);
      setMessage(complete ? "Ready." : "Saved.");
      onSaved?.(data.presentation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!presentation) {
    return <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: 13 }}>Loading…</p>;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={sheetStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
            Loadout
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, color: progress.complete ? cockpitColors.handled : cockpitColors.warning }}>
            {progress.done}/{progress.required}
          </div>
        </div>
        <div style={barTrack}>
          <div
            style={{
              ...barFill,
              width: `${progress.pct}%`,
              background: progress.complete
                ? `linear-gradient(90deg, ${cockpitColors.handled}, #14b8a6)`
                : `linear-gradient(90deg, ${cockpitColors.warning}, #f59e0b)`,
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }} className="vt-loadout-stats">
        <StatChip
          label="Trigger"
          value={shortTrigger(presentation.trigger?.modeLabel, presentation.trigger?.summary)}
          editing={editing}
          editor={(
            <div style={{ display: "grid", gap: 6 }}>
              <select value={triggerMode} onChange={(e) => setTriggerMode(e.target.value)} style={inputStyle}>
                {TRIGGER_MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <input
                value={triggerSummary}
                onChange={(e) => setTriggerSummary(e.target.value)}
                placeholder="When?"
                style={inputStyle}
              />
              {triggerMode === "schedule" || triggerMode === "manual_or_events" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <select
                    value={String(scheduleDraft.dayOfWeek)}
                    onChange={(e) => setScheduleDraft((s) => ({ ...s, dayOfWeek: Number(e.target.value) }))}
                    style={inputStyle}
                  >
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                      <option key={d} value={i}>{d}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={scheduleDraft.hourLocal}
                    onChange={(e) => setScheduleDraft((s) => ({ ...s, hourLocal: Number(e.target.value) }))}
                    placeholder="Hour"
                    style={inputStyle}
                  />
                </div>
              ) : null}
            </div>
          )}
        />
        <StatChip
          label="Runs"
          value={clip(presentation.executes?.summary, 72) || "Drafts for review"}
          editing={editing}
          editor={(
            <input
              value={executesSummary}
              onChange={(e) => setExecutesSummary(e.target.value)}
              placeholder="What it drafts"
              style={inputStyle}
            />
          )}
        />
        <StatChip
          label="Rules"
          value="Approve before send"
          editing={false}
          editor={null}
        />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
          Scope quest
        </div>
        {(presentation.scopeRows ?? []).map((row) => {
          const draft = scopeDraft[row.key] ?? { value: "", notApplicable: false, reason: "" };
          const filled = !row.missing;
          return (
            <div
              key={row.key}
              style={{
                ...questRow,
                borderColor: filled ? "rgba(4,120,87,0.28)" : "rgba(180,83,9,0.35)",
                background: filled ? "rgba(4,120,87,0.06)" : "rgba(180,83,9,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 12,
                  background: filled ? cockpitColors.handled : cockpitColors.inset,
                  color: filled ? "#fff" : cockpitColors.textMuted,
                  flexShrink: 0,
                }}
                >
                  {filled ? "✓" : "!"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 750, fontSize: 14, color: cockpitColors.textPrimary }}>{shortLabel(row.label)}</div>
                  {editing ? (
                    <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                      <input
                        value={draft.notApplicable ? "" : draft.value}
                        disabled={draft.notApplicable}
                        onChange={(e) => setScopeDraft((prev) => ({
                          ...prev,
                          [row.key]: { ...draft, value: e.target.value },
                        }))}
                        placeholder={row.placeholder || "Answer…"}
                        style={inputStyle}
                      />
                      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: cockpitColors.textMuted }}>
                        <input
                          type="checkbox"
                          checked={draft.notApplicable}
                          onChange={(e) => setScopeDraft((prev) => ({
                            ...prev,
                            [row.key]: { ...draft, notApplicable: e.target.checked },
                          }))}
                        />
                        N/A
                        {draft.notApplicable ? (
                          <input
                            value={draft.reason}
                            onChange={(e) => setScopeDraft((prev) => ({
                              ...prev,
                              [row.key]: { ...draft, reason: e.target.value },
                            }))}
                            placeholder="Why?"
                            style={{ ...inputStyle, flex: 1 }}
                          />
                        ) : null}
                      </label>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: filled ? cockpitColors.textSecondary : cockpitColors.warning, marginTop: 2 }}>
                      {filled ? (row.display || "Set") : "Locked — answer needed"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {editing ? (
          <>
            <PrimaryButton onClick={() => void save()} disabled={busy}>
              {busy ? "Saving…" : progress.complete ? "Save" : "Save progress"}
            </PrimaryButton>
            {progress.complete ? (
              <SecondaryButton onClick={() => setEditing(false)} disabled={busy}>Done</SecondaryButton>
            ) : null}
          </>
        ) : (
          <SecondaryButton onClick={() => setEditing(true)}>Edit loadout</SecondaryButton>
        )}
        {message ? <span style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.accent }}>{message}</span> : null}
        {error ? <span style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.critical }}>{error}</span> : null}
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  editing,
  editor,
}: {
  label: string;
  value: string;
  editing: boolean;
  editor: ReactNode;
}) {
  return (
    <div style={statChip}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
        {label}
      </div>
      {editing && editor ? editor : (
        <div style={{ fontSize: 13, fontWeight: 650, color: cockpitColors.textPrimary, lineHeight: 1.35, marginTop: 4 }}>
          {value}
        </div>
      )}
    </div>
  );
}

function shortLabel(label: string) {
  return String(label ?? "")
    .replace(/\s*\*\s*$/, "")
    .replace(/^Who receives messages\??/i, "Who")
    .replace(/^When should messages go out\??/i, "When")
    .replace(/^Channels to use/i, "Channels")
    .replace(/^How many messages \/ cadence/i, "How many")
    .replace(/^Tone and hard rules/i, "Rules")
    .replace(/^Which teams \/ age groups\??/i, "Teams / ages")
    .replace(/^When should plans be ready\??/i, "When")
    .replace(/^Who do they intake\??/i, "Who")
    .trim();
}

function shortTrigger(modeLabel?: string, summary?: string) {
  const mode = String(modeLabel ?? "Manual + events").replace(/ — .*$/, "").replace(/Manual or when events happen/i, "Manual + events");
  const tip = clip(summary, 40);
  return tip ? `${mode}` : mode;
}

function clip(value: string | undefined, n: number) {
  const s = String(value ?? "").trim();
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

const sheetStyle = {
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: cockpitColors.panel,
  display: "grid",
  gap: 8,
} as const;

const barTrack = {
  height: 10,
  borderRadius: 999,
  background: cockpitColors.inset,
  overflow: "hidden",
} as const;

const barFill = {
  height: "100%",
  borderRadius: 999,
  transition: "width 350ms ease",
} as const;

const statChip = {
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: cockpitColors.panel,
  minHeight: 72,
} as const;

const questRow = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid",
} as const;

const inputStyle = {
  width: "100%",
  borderRadius: 8,
  border: `1px solid ${cockpitColors.panelBorder}`,
  padding: "8px 10px",
  font: "inherit",
  fontSize: 13,
} as const;
