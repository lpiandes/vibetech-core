"use client";

import { useEffect, useState } from "react";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors } from "@/design/tokens";
import MessagePersonalizationField from "./MessagePersonalizationField";

const STEP_TYPES = [
  { id: "create_draft", label: "Create draft" },
  { id: "send_email", label: "Send email / text" },
  { id: "notify_team", label: "Alert your team" },
  { id: "add_to_pipeline", label: "Add to pipeline" },
] as const;

type PathStep = {
  id: string;
  type: string;
  label?: string;
  enabled?: boolean;
  order?: number;
  audience?: string;
  customRecipients?: string;
  /** Structured specific people — preferred over free-text customRecipients. */
  people?: Array<{ id?: string; name?: string; email?: string; phone?: string }>;
  subject?: string;
  body?: string;
  /** manual = Needs you when triggered; auto = runs without owner gate */
  runMode?: "manual" | "auto";
  requiresApproval?: boolean;
  pipelineLabel?: string;
  briefHint?: string;
  channel?: string;
  channels?: string[];
  direction?: "internal" | "external";
  tone?: string;
  kind?: string;
  displayTitle?: string;
  displaySummary?: string;
};

type PathPresentation = {
  trigger?: {
    label?: string;
    summary?: string;
    mode?: string;
    eventTypes?: string[];
  };
  steps?: PathStep[];
  path?: { steps?: PathStep[]; customized?: boolean };
};

/**
 * Zapier / GHL style vertical path: Trigger → Action → Action…
 * Each step owns its own email/SMS content (no global message footer).
 */
export default function AutomationPathEditor({
  businessId,
  employeeId,
  initialPath = null,
  onSaved,
  hideAiComposer = false,
}: {
  businessId: string;
  employeeId: string;
  initialPath?: PathPresentation | null;
  onSaved?: (presentation: PathPresentation) => void;
  hideAiComposer?: boolean;
}) {
  const [presentation, setPresentation] = useState<PathPresentation | null>(initialPath);
  const [steps, setSteps] = useState<PathStep[]>(initialPath?.steps ?? initialPath?.path?.steps ?? []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [proposalSummary, setProposalSummary] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  useEffect(() => {
    if (initialPath) {
      setPresentation(initialPath);
      setSteps(initialPath.steps ?? initialPath.path?.steps ?? []);
    }
  }, [initialPath]);

  async function save(nextSteps: PathStep[]) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/team/${encodeURIComponent(employeeId)}/operating-contract`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            automationPath: {
              version: 1,
              customized: true,
              steps: nextSteps.map((step, index) => ({ ...step, order: index })),
            },
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not save path.");
      const pathPres = data.presentation?.automationPath ?? null;
      setPresentation(pathPres);
      setSteps(pathPres?.steps ?? nextSteps);
      setMessage("Path saved.");
      onSaved?.(pathPres);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateStep(id: string, patch: Partial<PathStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addStepAt(type: string, atIndex: number) {
    const id = `step_${Date.now().toString(36)}`;
    const isOutbound = type === "send_email" || type === "send_sms" || type === "notify_team";
    const direction: "internal" | "external" = type === "notify_team" ? "internal" : "external";
    const channels = type === "send_sms" ? ["sms"] : type === "notify_team" ? ["email"] : ["email"];
    const runMode: "manual" | "auto" = (
      type === "add_to_pipeline" || type === "notify_team" || direction === "internal"
        ? "auto"
        : "manual"
    );
    const next: PathStep = {
      id,
      type: type === "create_draft"
        ? "create_draft"
        : type === "add_to_pipeline"
          ? "add_to_pipeline"
          : type === "send_sms"
            ? "send_sms"
            : type === "notify_team"
              ? "notify_team"
              : "send_email",
      label: type === "create_draft"
        ? "Create draft"
        : type === "add_to_pipeline"
          ? "Add to pipeline"
          : direction === "internal"
            ? "Alert your team"
            : "Send email / text",
      enabled: true,
      order: atIndex,
      direction: isOutbound ? direction : undefined,
      channels: isOutbound ? channels : undefined,
      audience: isOutbound ? (direction === "internal" ? "team" : "submitter") : undefined,
      subject: isOutbound && (direction === "internal" || type === "send_email") ? "New lead: [Name]" : "",
      body: isOutbound
        ? [
          "A new lead has been received.",
          "Lead details",
          "Name: [Name]",
          "Phone: [Phone]",
          "Email: [Email]",
        ].join("\n")
        : "",
      runMode,
      requiresApproval: runMode === "manual",
      pipelineLabel: type === "add_to_pipeline" ? "New leads" : undefined,
    };
    const nextSteps = [...steps.slice(0, atIndex), next, ...steps.slice(atIndex)];
    setSteps(nextSteps);
    setExpandedId(id);
    setAddMenuOpen(false);
    void save(nextSteps);
  }

  function patchOutbound(step: PathStep, patch: Partial<PathStep>) {
    const next = { ...step, ...patch };
    const direction = (next.direction ?? (next.type === "notify_team" ? "internal" : "external")) as
      "internal" | "external";
    const channels = normalizeChannels(next.channels, next.type, next.channel);
    // Keep step type in sync with destination + channels for older runners.
    if (direction === "internal" && channels.length === 1 && channels[0] === "email") {
      next.type = "notify_team";
    } else if (channels.length === 1 && channels[0] === "sms") {
      next.type = "send_sms";
    } else {
      next.type = "send_email";
    }
    next.direction = direction;
    next.channels = channels;
    next.channel = channels.includes("sms") && channels.includes("email")
      ? "email,sms"
      : channels.includes("sms")
        ? "sms"
        : "email";
    if (direction === "internal") {
      if (next.runMode == null) next.runMode = "auto";
      next.requiresApproval = next.runMode === "manual";
      if (!next.audience || next.audience === "scope_who" || next.audience === "submitter") {
        next.audience = "team";
      }
    } else if (next.audience === "team") {
      next.audience = "submitter";
      if (next.runMode == null) next.runMode = "manual";
      next.requiresApproval = next.runMode !== "auto";
    }
    updateStep(step.id, next);
  }

  function removeStep(id: string) {
    const nextSteps = steps.filter((s) => s.id !== id);
    setSteps(nextSteps);
    void save(nextSteps);
  }

  function moveStep(id: string, dir: -1 | 1) {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    setSteps(next);
    void save(next);
  }

  const trigger = presentation?.trigger;

  async function applyPlainEnglish(apply = true) {
    if (!instruction.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/team/${encodeURIComponent(employeeId)}/automation-path/propose`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ instruction, apply }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.hint ?? data.reason ?? data.error ?? "Could not update path");
      setProposalSummary(data.proposal?.summary ?? null);
      if (apply && data.presentation?.automationPath) {
        setPresentation(data.presentation.automationPath);
        setSteps(data.presentation.automationPath.steps ?? []);
        setMessage(`Applied: ${data.proposal?.summary ?? "path updated"}`);
        setInstruction("");
        onSaved?.(data.presentation.automationPath);
      } else if (!apply) {
        setMessage(`Preview: ${data.proposal?.summary ?? "ready"} — click Apply to save`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 0, maxWidth: 520, margin: "0 auto", width: "100%" }}>
      {!hideAiComposer ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: "linear-gradient(180deg, #ecfdf5 0%, #f7f6f3 100%)",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
            Describe a change
          </div>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. Add an email to the team with subject "New signup" — or Change the SMS to say "Practice cancelled"'
            rows={2}
            style={inputStyle}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <PrimaryButton onClick={() => void applyPlainEnglish(true)} disabled={busy || !instruction.trim()}>
              {busy ? "…" : "Apply with AI"}
            </PrimaryButton>
            <SecondaryButton onClick={() => void applyPlainEnglish(false)} disabled={busy || !instruction.trim()}>
              Preview
            </SecondaryButton>
          </div>
          {proposalSummary ? (
            <div style={{ fontSize: 12, color: cockpitColors.textSecondary }}>{proposalSummary}</div>
          ) : null}
        </div>
      ) : null}

      <PathNode
        kind="trigger"
        title={trigger?.label ?? "How this starts"}
        subtitle={
          trigger?.summary
          || "Manual: Run now. LIVE automatic: Calendar / schedule / configured events."
        }
        badge="START"
        tone="trigger"
      />

      {steps.map((step, index) => {
        const open = expandedId === step.id;
        const muted = step.enabled === false;
        return (
          <div key={step.id}>
            <AddConnector
              onAdd={(type) => addStepAt(type, index)}
              busy={busy}
            />
            <div
              style={{
                ...nodeCard,
                opacity: muted ? 0.55 : 1,
                borderColor: open ? cockpitColors.accent : "rgba(28,25,23,0.12)",
                boxShadow: "0 2px 10px rgba(28,25,23,0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : step.id)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: cockpitColors.textMuted }}>
                    {typeBadge(step.type, step)}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: cockpitColors.textPrimary, marginTop: 2 }}>
                    {step.displayTitle || simpleStepTitle(step.type, step)}
                  </div>
                  <div style={{ fontSize: 12, color: cockpitColors.textSecondary, marginTop: 4, lineHeight: 1.45 }}>
                    {shortStepSummary(step)}
                  </div>
                </button>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  <RunModeToggle
                    value={stepRunMode(step)}
                    disabled={busy}
                    onChange={(runMode) => {
                      updateStep(step.id, {
                        runMode,
                        requiresApproval: runMode === "manual",
                      });
                      void save(
                        steps.map((s) => (
                          s.id === step.id
                            ? { ...s, runMode, requiresApproval: runMode === "manual" }
                            : s
                        )),
                      );
                    }}
                  />
                  <IconBtn onClick={() => moveStep(step.id, -1)} title="Move up">↑</IconBtn>
                  <IconBtn onClick={() => moveStep(step.id, 1)} title="Move down">↓</IconBtn>
                </div>
              </div>

              {open ? (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <input
                    value={step.label ?? ""}
                    onChange={(e) => updateStep(step.id, { label: e.target.value })}
                    placeholder="Internal note (optional)"
                    style={inputStyle}
                  />
                  <label style={checkLabel}>
                    <input
                      type="checkbox"
                      checked={step.enabled !== false}
                      onChange={(e) => updateStep(step.id, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>

                  {(step.type === "send_email" || step.type === "send_sms" || step.type === "notify_team") ? (
                    <OutboundDestinationEditor
                      step={step}
                      busy={busy}
                      onPatch={(patch) => patchOutbound(step, patch)}
                    />
                  ) : null}

                  {step.type === "add_to_pipeline" ? (
                    <input
                      value={step.pipelineLabel ?? ""}
                      onChange={(e) => updateStep(step.id, { pipelineLabel: e.target.value })}
                      placeholder="Pipeline name"
                      style={inputStyle}
                    />
                  ) : null}

                  {step.type === "create_draft" ? (
                    <p style={{ margin: 0, fontSize: 13, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
                      {stepRunMode(step) === "manual"
                        ? "Manual: when this runs, the draft shows in Needs you on Home until you review it."
                        : "Auto: prepares Work quietly — it won’t appear in Needs you."}
                    </p>
                  ) : null}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <PrimaryButton onClick={() => void save(steps)} disabled={busy}>
                      {busy ? "Saving…" : "Save step"}
                    </PrimaryButton>
                    <SecondaryButton onClick={() => removeStep(step.id)} disabled={busy}>
                      Remove
                    </SecondaryButton>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      <AddConnector
        onAdd={(type) => addStepAt(type, steps.length)}
        busy={busy}
        defaultOpen={addMenuOpen}
        onOpenChange={setAddMenuOpen}
      />

      {message ? <p style={{ margin: "8px 0 0", color: cockpitColors.accent, fontSize: 13, fontWeight: 700 }}>{message}</p> : null}
      {error ? <p style={{ margin: "8px 0 0", color: cockpitColors.critical, fontSize: 13, fontWeight: 700 }}>{error}</p> : null}
    </div>
  );
}

function PathNode({
  kind,
  title,
  subtitle,
  badge,
  tone,
}: {
  kind: string;
  title: string;
  subtitle: string;
  badge: string;
  tone: string;
}) {
  const bg = tone === "trigger" ? "#0f766e" : "#fff";
  const color = tone === "trigger" ? "#fff" : cockpitColors.textPrimary;
  return (
    <div
      style={{
        ...nodeCard,
        background: bg,
        color,
        borderColor: tone === "trigger" ? "transparent" : "rgba(28,25,23,0.12)",
        boxShadow: "0 2px 10px rgba(28,25,23,0.06)",
      }}
      data-kind={kind}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", opacity: 0.8 }}>{badge}</div>
      <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85, lineHeight: 1.4 }}>{subtitle}</div>
    </div>
  );
}

function AddConnector({
  onAdd,
  busy,
  defaultOpen = false,
  onOpenChange,
}: {
  onAdd: (type: string) => void;
  busy?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  function setOpenState(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 0, padding: "2px 0" }}>
      <div style={{ width: 2, height: 10, background: "#d6d3d1" }} />
      <div style={{ position: "relative" }}>
        <button
          type="button"
          title="Add step"
          disabled={busy}
          onClick={() => setOpenState(!open)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: `2px solid ${cockpitColors.accent}`,
            background: "#fff",
            color: cockpitColors.accent,
            fontWeight: 900,
            fontSize: 18,
            lineHeight: 1,
            cursor: busy ? "wait" : "pointer",
            boxShadow: "0 2px 8px rgba(15,118,110,0.15)",
          }}
        >
          +
        </button>
        {open ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: 34,
              zIndex: 5,
              minWidth: 180,
              display: "grid",
              gap: 4,
              padding: 8,
              borderRadius: 12,
              border: `1px solid ${cockpitColors.panelBorder}`,
              background: "#fff",
              boxShadow: "0 10px 28px rgba(28,25,23,0.12)",
            }}
          >
            {STEP_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onAdd(t.id);
                  setOpenState(false);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  color: cockpitColors.textPrimary,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ width: 2, height: 10, background: "#d6d3d1" }} />
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: string; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: cockpitColors.inset,
        cursor: "pointer",
        fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}

function typeBadge(type: string, step?: PathStep) {
  const channels = normalizeChannels(step?.channels, type, step?.channel);
  const hasEmail = channels.includes("email");
  const hasSms = channels.includes("sms");
  if (hasEmail && hasSms) return "EMAIL+SMS";
  if (hasSms) return "SMS";
  if (type === "add_to_pipeline") return "PIPELINE";
  if (type === "create_draft") return "DRAFT";
  if (step?.direction === "internal" || type === "notify_team") return "TEAM";
  return "EMAIL";
}

function simpleStepTitle(type: string, step?: PathStep) {
  if (type === "add_to_pipeline") return "Add to pipeline";
  if (type === "create_draft") return "Create draft";
  const direction = step?.direction ?? (type === "notify_team" ? "internal" : "external");
  return direction === "internal" ? "Alert your team" : "Send email / text";
}

function stepDescription(step: PathStep) {
  if (step.enabled === false) return "Turned off";
  const mode = stepRunMode(step) === "manual" ? "Manual" : "Auto";
  if (step.type === "add_to_pipeline") {
    return stepRunMode(step) === "manual"
      ? `Manual · Ask you before adding a card to “${step.pipelineLabel || "follow-up"}”`
      : `Auto · Creates a card in “${step.pipelineLabel || "follow-up"}”`;
  }
  if (step.type === "create_draft") {
    return stepRunMode(step) === "manual"
      ? "Manual · Opens Work in Needs you for your review"
      : "Auto · Prepares Work without pinging Needs you";
  }

  const direction = step.direction ?? (step.type === "notify_team" ? "internal" : "external");
  const channels = normalizeChannels(step.channels, step.type, step.channel);
  const channelLabel = channels.includes("email") && channels.includes("sms")
    ? "Email + text"
    : channels.includes("sms")
      ? "Text"
      : "Email";
  const to = audienceLabel(step.audience, direction);
  if (direction === "internal") {
    return `${mode} · ${channelLabel} to ${to} · Internal (no customer send)`;
  }
  const approval = stepRunMode(step) === "auto" ? "Sends when this runs" : "Needs you before send";
  if (step.subject?.trim()) return `${mode} · ${channelLabel} to ${to} · “${clip(step.subject, 36)}” · ${approval}`;
  if (step.body?.trim()) return `${mode} · ${channelLabel} to ${to} · “${clip(step.body, 36)}” · ${approval}`;
  return `${mode} · ${channelLabel} to ${to} · ${approval}`;
}

function stepRunMode(step: PathStep): "manual" | "auto" {
  if (step.runMode === "manual" || step.runMode === "auto") return step.runMode;
  if (step.requiresApproval === false) return "auto";
  if (step.direction === "internal" || step.type === "notify_team") return "auto";
  if (step.type === "add_to_pipeline") return "auto";
  return "manual";
}

function RunModeToggle({
  value,
  disabled,
  onChange,
}: {
  value: "manual" | "auto";
  disabled?: boolean;
  onChange: (mode: "manual" | "auto") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Manual or Auto"
      style={{
        display: "inline-flex",
        borderRadius: 8,
        border: `1px solid ${cockpitColors.panelBorder}`,
        overflow: "hidden",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {(["manual", "auto"] as const).map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            title={mode === "manual" ? "Manual — shows in Needs you when this runs" : "Auto — runs without Needs you"}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled && mode !== value) onChange(mode);
            }}
            style={{
              border: "none",
              background: active ? cockpitColors.accent : cockpitColors.inset,
              color: active ? "#fff" : cockpitColors.textSecondary,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
              padding: "6px 8px",
              cursor: disabled ? "default" : "pointer",
              textTransform: "uppercase",
            }}
          >
            {mode === "manual" ? "Manual" : "Auto"}
          </button>
        );
      })}
    </div>
  );
}

/** Prefer live description; never show a novel-length stored displaySummary. */
function shortStepSummary(step: PathStep) {
  const live = stepDescription(step);
  const stored = String(step.displaySummary ?? "").trim();
  if (!stored) return live;
  if (step.type === "create_draft") return live;
  if (stored.length > 110) return live;
  return stored;
}

function audienceLabel(id?: string, direction?: string) {
  switch (id) {
    case "team":
      return "your business team";
    case "submitter":
      return direction === "external" ? "the lead / person who triggered this" : "the person who triggered this";
    case "custom":
      return "specific people you list";
    case "scope_who":
      return "people in Scope";
    default:
      return direction === "internal" ? "your business team" : "the lead";
  }
}

function normalizeChannels(
  channels?: string[] | null,
  type?: string,
  channel?: string,
): string[] {
  if (Array.isArray(channels) && channels.length) {
    return [...new Set(channels.map(String).filter((c) => c === "email" || c === "sms"))];
  }
  const raw = String(channel ?? "");
  if (raw.includes("sms") && raw.includes("email")) return ["email", "sms"];
  if (raw.includes("sms") || type === "send_sms") return ["sms"];
  return ["email"];
}

function OutboundDestinationEditor({
  step,
  busy,
  onPatch,
}: {
  step: PathStep;
  busy?: boolean;
  onPatch: (patch: Partial<PathStep>) => void;
}) {
  const direction = (step.direction ?? (step.type === "notify_team" ? "internal" : "external")) as
    "internal" | "external";
  const channels = normalizeChannels(step.channels, step.type, step.channel);
  const audience = step.audience
    ?? (direction === "internal" ? "team" : "submitter");
  const showEmail = channels.includes("email");

  function toggleChannel(channel: "email" | "sms", on: boolean) {
    const next = new Set(channels);
    if (on) next.add(channel);
    else next.delete(channel);
    if (!next.size) next.add(channel === "email" ? "sms" : "email");
    onPatch({ channels: [...next] });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.textSecondary }}>
          Send to
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <DestinationChoice
            active={direction === "internal"}
            title="Your team"
            subtitle="Internal alert"
            disabled={busy}
            onClick={() => onPatch({ direction: "internal", audience: "team", requiresApproval: false, runMode: "auto" })}
          />
          <DestinationChoice
            active={direction === "external"}
            title="Customers / leads"
            subtitle="External message"
            disabled={busy}
            onClick={() => onPatch({
              direction: "external",
              audience: audience === "team" ? "submitter" : audience,
              requiresApproval: true,
              runMode: "manual",
            })}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.textSecondary }}>
          Send as
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <label style={checkLabel}>
            <input
              type="checkbox"
              checked={channels.includes("email")}
              disabled={busy}
              onChange={(e) => toggleChannel("email", e.target.checked)}
            />
            Email
          </label>
          <label style={checkLabel}>
            <input
              type="checkbox"
              checked={channels.includes("sms")}
              disabled={busy}
              onChange={(e) => toggleChannel("sms", e.target.checked)}
            />
            Text (SMS)
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.textSecondary }}>
          Who gets it
        </div>
        <select
          value={audience}
          disabled={busy}
          onChange={(e) => onPatch({ audience: e.target.value })}
          style={inputStyle}
        >
          {direction === "internal" ? (
            <>
              <option value="team">Everyone on your business team</option>
              <option value="custom">Specific people</option>
            </>
          ) : (
            <>
              <option value="submitter">The lead / person who triggered this</option>
              <option value="scope_who">People in Scope</option>
              <option value="custom">Specific people</option>
            </>
          )}
        </select>
      </div>

      {audience === "custom" ? (
        <SpecificPeopleEditor
          people={readPeople(step)}
          channels={channels}
          disabled={busy}
          onChange={(people) => onPatch({
            people,
            customRecipients: serializePeopleToCustomRecipients(people, channels),
          })}
        />
      ) : null}

      {showEmail ? (
        <input
          value={step.subject ?? ""}
          disabled={busy}
          onChange={(e) => onPatch({ subject: e.target.value })}
          placeholder="Email subject — you can type [Name] here too"
          style={inputStyle}
        />
      ) : null}

      <MessagePersonalizationField
        value={step.body ?? ""}
        onChange={(body) => onPatch({ body })}
        placeholder={
          channels.includes("sms") && !channels.includes("email")
            ? "Write the text… tap Insert chips for Name, Phone, Email"
            : "Write the message… tap Insert chips for Name, Phone, Email"
        }
        rows={channels.includes("sms") && !channels.includes("email") ? 5 : 6}
        style={inputStyle}
        disabled={busy}
      />

      {direction === "external" ? (
        <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
          Use the Manual / Auto toggle on this step: Manual waits in Needs you; Auto sends when the workflow runs.
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
          Internal alerts go to your team — they don’t message customers.
        </p>
      )}
    </div>
  );
}

function DestinationChoice({
  active,
  title,
  subtitle,
  disabled,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        textAlign: "left",
        borderRadius: 10,
        border: `1.5px solid ${active ? cockpitColors.accent : cockpitColors.panelBorder}`,
        background: active ? "rgba(15,118,110,0.08)" : cockpitColors.inset,
        padding: "10px 12px",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.textPrimary }}>{title}</div>
      <div style={{ fontSize: 12, color: cockpitColors.textSecondary, marginTop: 2 }}>{subtitle}</div>
    </button>
  );
}

type PersonRow = { id: string; name: string; email: string; phone: string };

function newPersonId() {
  return `person_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyPerson(): PersonRow {
  return { id: newPersonId(), name: "", email: "", phone: "" };
}

function readPeople(step: PathStep): PersonRow[] {
  if (Array.isArray(step.people) && step.people.length) {
    return step.people.map((person, index) => ({
      id: String(person.id ?? `person_${index}`),
      name: String(person.name ?? ""),
      email: String(person.email ?? ""),
      phone: String(person.phone ?? ""),
    }));
  }
  const legacy = String(step.customRecipients ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!legacy.length) return [emptyPerson()];
  return legacy.map((entry) => {
    if (entry.includes("@")) {
      return { id: newPersonId(), name: "", email: entry, phone: "" };
    }
    return { id: newPersonId(), name: "", email: "", phone: entry };
  });
}

function serializePeopleToCustomRecipients(
  people: PersonRow[],
  channels: string[],
): string {
  const wantEmail = channels.includes("email");
  const wantSms = channels.includes("sms");
  return people
    .map((person) => {
      const parts = [];
      if (wantEmail && person.email.trim()) parts.push(person.email.trim());
      if (wantSms && person.phone.trim()) parts.push(person.phone.trim());
      return parts.join("\n");
    })
    .filter(Boolean)
    .join("\n");
}

function SpecificPeopleEditor({
  people,
  channels,
  disabled,
  onChange,
}: {
  people: PersonRow[];
  channels: string[];
  disabled?: boolean;
  onChange: (people: PersonRow[]) => void;
}) {
  const wantEmail = channels.includes("email");
  const wantSms = channels.includes("sms");
  const rows = people.length ? people : [emptyPerson()];

  function updateRow(id: string, patch: Partial<PersonRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    const next = rows.filter((row) => row.id !== id);
    onChange(next.length ? next : [emptyPerson()]);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((person, index) => (
        <div
          key={person.id}
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: wantEmail && wantSms
              ? "minmax(0,1.1fr) minmax(0,1.3fr) minmax(0,1.2fr) auto"
              : "minmax(0,1fr) minmax(0,1.4fr) auto",
            alignItems: "center",
          }}
        >
          <input
            value={person.name}
            disabled={disabled}
            onChange={(e) => updateRow(person.id, { name: e.target.value })}
            placeholder="Name"
            aria-label={`Person ${index + 1} name`}
            style={inputStyle}
          />
          {wantEmail ? (
            <input
              value={person.email}
              disabled={disabled}
              onChange={(e) => updateRow(person.id, { email: e.target.value })}
              placeholder="Email"
              inputMode="email"
              aria-label={`Person ${index + 1} email`}
              style={inputStyle}
            />
          ) : null}
          {wantSms ? (
            <input
              value={person.phone}
              disabled={disabled}
              onChange={(e) => updateRow(person.id, { phone: e.target.value })}
              placeholder="Phone"
              inputMode="tel"
              aria-label={`Person ${index + 1} phone`}
              style={inputStyle}
            />
          ) : null}
          <button
            type="button"
            title="Remove"
            disabled={disabled || rows.length <= 1}
            onClick={() => removeRow(person.id)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
              background: cockpitColors.inset,
              color: cockpitColors.textSecondary,
              cursor: disabled || rows.length <= 1 ? "default" : "pointer",
              fontWeight: 700,
              opacity: rows.length <= 1 ? 0.4 : 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, emptyPerson()])}
        style={{
          justifySelf: "start",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 999,
          border: `1px solid ${cockpitColors.panelBorder}`,
          background: "#fff",
          color: cockpitColors.textPrimary,
          padding: "6px 12px",
          fontSize: 13,
          fontWeight: 700,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <span aria-hidden>+</span>
        Add person
      </button>
    </div>
  );
}

function clip(text: string, max: number) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const nodeCard = {
  borderRadius: 12,
  border: "1px solid",
  padding: "14px 16px",
  background: "#fff",
  width: "100%",
} as const;

const inputStyle = {
  width: "100%",
  borderRadius: 8,
  border: `1px solid ${cockpitColors.panelBorder}`,
  padding: "8px 10px",
  font: "inherit",
  fontSize: 13,
} as const;

const checkLabel = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 13,
  color: cockpitColors.textSecondary,
} as const;
