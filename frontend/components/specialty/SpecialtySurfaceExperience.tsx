"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import AutomationPathEditor from "@/components/specialty/AutomationPathEditor";
import {
  VtActiveToggle,
  VtPage,
  VtPanel,
  vtInputStyle,
} from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

import type { SpecialtyArtifactPreview } from "@/components/specialty/SpecialtyDeliverableView";
import { describeHowAutomationStarts } from "../../../backend/core/ai-builder/specialty/triggerHowItStarts.js";

export type SpecialtyWorkItem = {
  id: string;
  title: string;
  status: string;
  updatedAt?: string | null;
  artifactTitle?: string | null;
  artifactBody?: string | null;
  artifact?: SpecialtyArtifactPreview | null;
  workHref?: string | null;
};

export type SpecialtySurfaceModel = {
  businessId: string;
  surfaceId: string;
  surfaceKind: "module" | "ai_teammate";
  name: string;
  purpose: string;
  blocks: string[];
  employeeId: string | null;
  statusLabel: string;
  askHref: string;
  workHref: string;
  knowledgeHref: string;
  integrationsHref: string;
  teamHref: string;
  workItems: SpecialtyWorkItem[];
  automationsActive?: boolean | null;
  linkedAutomationCount?: number;
  nextScheduleAt?: string | null;
  readiness?: {
    ready?: boolean;
    missingKnowledge?: string[];
    missingConnections?: string[];
    blockerSummary?: string | null;
  } | null;
  readyChecklist?: {
    ready?: boolean;
    completeCount?: number;
    total?: number;
    statusLabel?: string;
    items?: Array<{ id: string; label: string; complete: boolean; detail: string }>;
  } | null;
  operatingContract?: Record<string, unknown> | null;
  contractComplete?: boolean | null;
  linkedAutomations?: Array<{
    id: string;
    name: string;
    status: string;
    triggerSummary?: string;
  }>;
};

type Tab = "path" | "logs";
type ChatTurn = { role: "user" | "assistant"; text: string };
type StepOutcome = "succeeded" | "deferred" | "failed";
type ActivityStep = {
  label: string;
  outcome: StepOutcome;
  detail?: string;
};
type ActivityEntry = {
  at: string;
  title: string;
  detail: string;
  steps?: ActivityStep[];
};

export default function SpecialtySurfaceExperience({ model }: { model: SpecialtySurfaceModel }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"run" | "auto" | "rename" | "chat" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoQuotaRemaining, setAutoQuotaRemaining] = useState<number | null>(null);
  const [automationsActive, setAutomationsActive] = useState(model.automationsActive ?? false);
  const [nextScheduleAt, setNextScheduleAt] = useState(model.nextScheduleAt ?? null);
  const [pathPres, setPathPres] = useState((model.operatingContract as any)?.automationPath ?? null);
  const [name, setName] = useState(model.name);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(model.name);
  const [tab, setTab] = useState<Tab>("path");
  const [chatInput, setChatInput] = useState("");
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [chat, setChat] = useState<ChatTurn[]>([
    {
      role: "assistant",
      text: "Describe a path change to review — for example, “When a pipeline stage changes, draft an email to the team” or “Add an SMS step.”",
    },
  ]);

  useEffect(() => {
    setAutomationsActive(model.automationsActive ?? false);
    setNextScheduleAt(model.nextScheduleAt ?? null);
    setPathPres((model.operatingContract as any)?.automationPath ?? null);
    setName(model.name);
    setNameDraft(model.name);
  }, [model]);

  const isAi = model.surfaceKind === "ai_teammate";
  const canRun = isAi && Boolean(model.employeeId);
  const openWorkHref = model.workItems[0]?.workHref || model.workHref;

  async function renameAutomation() {
    if (!model.employeeId) return;
    const next = nameDraft.trim();
    setEditingName(false);
    if (!next || next === name) return;
    setBusy("rename");
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(model.businessId)}/team/${encodeURIComponent(model.employeeId)}/operating-contract`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ label: next }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error ?? "Could not rename");
      setName(String(json.label ?? next));
      setMessage("Name updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
      setNameDraft(name);
    } finally {
      setBusy(null);
    }
  }

  async function runNow() {
    if (!model.employeeId) return;
    setBusy("run");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(model.businessId)}/team/${encodeURIComponent(model.employeeId)}/triggers`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            eventType: "SPECIALTY_JOB_REQUESTED",
            forceManual: true,
            brief: `Owner ran ${name} now`,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.reason ?? json?.error ?? "Could not run automation");
      }
      const pathNotes = Array.isArray(json?.result?.pathExecution?.notes)
        ? json.result.pathExecution.notes
        : [];
      const workOk = Boolean(json?.result?.workItemId ?? json?.result?.ok);
      const plannedSteps = plannedPathSteps(pathPres);
      const noteSteps = pathNotes.map((n: any) => pathNoteToStep(n));
      // Prefer live execution notes. Never invent Succeeded when notes are missing.
      const actionSteps = noteSteps.length
        ? noteSteps
        : plannedSteps.map((step) => ({
          label: step.label,
          outcome: "failed" as const,
          detail: "No step result returned — open Logs after Run now again",
        }));
      const steps: ActivityStep[] = [
        {
          label: "Draft Work",
          outcome: workOk ? "succeeded" : "failed",
          detail: workOk
            ? "Created for review"
            : String(json?.result?.reason ?? json?.reason ?? "Could not create Work"),
        },
        // Draft Work above already covers create_draft — show the remaining path actions.
        ...actionSteps.filter((step) => !/^(create draft|draft work)$/i.test(step.label)),
      ];
      const succeeded = steps.filter((s) => s.outcome === "succeeded").length;
      const deferred = steps.filter((s) => s.outcome === "deferred").length;
      const failed = steps.filter((s) => s.outcome === "failed").length;
      const summaryParts = [
        succeeded ? `${succeeded} succeeded` : null,
        deferred ? `${deferred} need approval` : null,
        failed ? `${failed} failed` : null,
      ].filter(Boolean);
      setActivity((prev) => [
        {
          at: new Date().toISOString(),
          title: "Run now",
          detail: summaryParts.join(" · ") || "Draft Work created",
          steps,
        },
        ...prev,
      ].slice(0, 40));
      setMessage(
        failed > 0
          ? `Ran with issues — ${summaryParts.join(", ")}. Connect missing channels in Integrations, then run again.`
          : deferred > 0
            ? `Ran — ${summaryParts.join(", ")}. Open Work to approve Email/SMS before send.`
            : `Ran — ${summaryParts.join(", ") || "all steps finished"}.`,
      );
      setTab("logs");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run automation");
    } finally {
      setBusy(null);
    }
  }

  async function toggleAutomations() {
    if (!model.employeeId) return;
    const next = automationsActive ? "INACTIVE" : "ACTIVE";
    setBusy("auto");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(model.businessId)}/team/${encodeURIComponent(model.employeeId)}/automations/status`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error ?? "Could not update automation");
      const active = Boolean(json?.result?.active ?? next === "ACTIVE");
      setAutomationsActive(active);
      if (json?.result?.schedule?.runAfter) {
        setNextScheduleAt(String(json.result.schedule.runAfter));
      }
      setMessage(active
        ? "LIVE — Calendar creates/updates and schedules can start this path. Run now still works anytime."
        : "OFF — only Run now starts this path.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update automation");
    } finally {
      setBusy(null);
    }
  }

  async function sendChat(apply: boolean) {
    if (!model.employeeId || !chatInput.trim()) return;
    const instruction = chatInput.trim();
    setChat((prev) => [...prev, { role: "user", text: instruction }]);
    setChatInput("");
    setBusy("chat");
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(model.businessId)}/team/${encodeURIComponent(model.employeeId)}/automation-path/propose`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ instruction, apply }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (data.quota && typeof data.quota.remaining === "number") {
        setAutoQuotaRemaining(data.quota.remaining);
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? data.message ?? data.hint ?? data.reason ?? "Could not update path");
      }
      const summary = String(data.proposal?.summary ?? (apply ? "Path updated." : "Preview ready."));
      const source = data.proposal?.source ? ` (${data.proposal.source})` : "";
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          text: apply ? `Applied${source}: ${summary}` : `Preview${source}: ${summary} — click Apply to save.`,
        },
      ]);
      if (apply && data.presentation?.automationPath) {
        setPathPres(data.presentation.automationPath);
        setMessage(`Applied: ${summary}`);
        router.refresh();
      } else if (apply && data.proposal?.proposedPath) {
        setPathPres(data.proposal.proposedPath);
        setMessage(`Applied: ${summary}`);
        router.refresh();
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Update failed";
      setError(text);
      setChat((prev) => [...prev, { role: "assistant", text }]);
    } finally {
      setBusy(null);
    }
  }

  if (!isAi) {
    return (
      <VtPage>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <h1 style={titleStyle}>{model.name}</h1>
          <StatusBadge label={model.statusLabel} tone="neutral" />
        </header>
        <SecondaryButton href={model.teamHref}>← Team</SecondaryButton>
      </VtPage>
    );
  }

  return (
    <VtPage maxWidth="none">
      <header style={topBar}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
            {isAi ? "Operating responsibility" : "Automation"}
          </div>
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => void renameAutomation()}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void renameAutomation();
                }
                if (e.key === "Escape") {
                  setEditingName(false);
                  setNameDraft(name);
                }
              }}
              aria-label="Automation name"
              style={{ ...vtInputStyle, marginTop: 6, fontSize: "1.35rem", fontWeight: 900, maxWidth: 520 }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(name);
                setEditingName(true);
              }}
              title="Click to rename"
              style={nameBtn}
            >
              {name}
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
                edit
              </span>
            </button>
          )}
          {automationsActive && nextScheduleAt ? (
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: cockpitColors.accent }}>
              Next automatic run · {formatWhen(nextScheduleAt)}
            </div>
          ) : null}
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 650, color: cockpitColors.textSecondary, lineHeight: 1.45, maxWidth: 640 }}>
            {describeHowAutomationStarts({
              trigger: readTriggerObject(model.operatingContract),
              live: automationsActive,
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <VtActiveToggle
            active={automationsActive}
            busy={busy === "auto"}
            onClick={() => void toggleAutomations()}
            activeLabel="LIVE"
            inactiveLabel="OFF"
          />
          <PrimaryButton onClick={() => void runNow()} disabled={!canRun || busy === "run"}>
            {busy === "run" ? "Running…" : "Run now"}
          </PrimaryButton>
          <SecondaryButton href={`/b/${encodeURIComponent(model.businessId)}/${isAi ? "intelligence" : "automations"}`}>
            {isAi ? "Open Decisions" : "All automations"}
          </SecondaryButton>
        </div>
      </header>

      {isAi ? (
        <VtPanel title="Managed Revenue Follow-Through">
          <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
            VIBETech runs this as Managed Revenue Follow-Through. Prefer Decisions and Company Rules over building automations.
          </p>
        </VtPanel>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setTab("path")} style={tabChip(tab === "path")}>Path</button>
        <button type="button" onClick={() => setTab("logs")} style={tabChip(tab === "logs")}>
          This session{model.workItems.length ? ` (${model.workItems.length})` : ""}
        </button>
      </div>

      {tab === "path" && canRun ? (
        <div className="vt-auto-builder" style={builderGrid}>
          <aside style={chatPane}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
              {isAi ? "Advanced path changes" : "AI assistant"}
              {autoQuotaRemaining != null ? (
                <span style={{ fontWeight: 650, letterSpacing: 0, textTransform: "none", marginLeft: 8, color: cockpitColors.textMuted }}>
                  · {autoQuotaRemaining}/5 today
                </span>
              ) : null}
            </div>
            {isAi ? (
              <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.5 }}>
                Use this only when the managed path needs a deliberate contract change.
              </p>
            ) : null}
            <div style={chatScroll}>
              {chat.map((turn, i) => (
                <div
                  key={`${turn.role}-${i}`}
                  style={{
                    alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "92%",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: turn.role === "user" ? cockpitColors.accent : "#fff",
                    color: turn.role === "user" ? "#fff" : cockpitColors.textPrimary,
                    border: turn.role === "user" ? "none" : `1px solid ${cockpitColors.panelBorder}`,
                    fontSize: 13,
                    fontWeight: 650,
                    lineHeight: 1.45,
                  }}
                >
                  {turn.text}
                </div>
              ))}
            </div>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Describe a change…"
              rows={3}
              style={{ ...vtInputStyle, resize: "vertical" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat(true);
                }
              }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <PrimaryButton onClick={() => void sendChat(true)} disabled={busy === "chat" || !chatInput.trim()}>
                {busy === "chat" ? "…" : "Apply"}
              </PrimaryButton>
              <SecondaryButton onClick={() => void sendChat(false)} disabled={busy === "chat" || !chatInput.trim()}>
                Preview
              </SecondaryButton>
            </div>
          </aside>

          <section style={pathPane}>
            {model.employeeId ? (
              <AutomationPathEditor
                businessId={model.businessId}
                employeeId={model.employeeId}
                initialPath={pathPres}
                hideAiComposer
                onSaved={(pres) => {
                  setPathPres(pres);
                  router.refresh();
                }}
              />
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === "logs" ? (
        <VtPanel title="This session">
          {activity.length === 0 && model.workItems.length === 0 ? (
            <p style={{ margin: 0, color: cockpitColors.textMuted, fontWeight: 650 }}>
              No runs in this browser session yet. Click Run now, or turn LIVE on so this path can start from its configured events.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {activity.map((entry, i) => (
                <div
                  key={`act-${i}-${entry.at}`}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{entry.title}</div>
                  <div style={{ fontSize: 12, color: cockpitColors.textMuted, marginTop: 4, fontWeight: 650 }}>
                    {formatWhen(entry.at)} · {entry.detail}
                  </div>
                  {entry.steps?.length ? (
                    <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                      {entry.steps.map((step, stepIndex) => (
                        <li
                          key={`${step.label}-${stepIndex}`}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            fontSize: 13,
                            fontWeight: 650,
                          }}
                        >
                          <span style={{ color: outcomeColor(step.outcome), fontWeight: 800, minWidth: 92 }}>
                            {outcomeLabel(step.outcome)}
                          </span>
                          <span style={{ color: cockpitColors.textPrimary }}>
                            {step.label}
                            {step.detail ? (
                              <span style={{ color: cockpitColors.textMuted, fontWeight: 600 }}>
                                {" — "}
                                {step.detail}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
              {model.workItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    background: "#fff",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: cockpitColors.textMuted, marginTop: 4, fontWeight: 650 }}>
                      {item.status}
                      {item.updatedAt ? ` · ${formatWhen(item.updatedAt)}` : ""}
                    </div>
                  </div>
                  <SecondaryButton href={item.workHref || openWorkHref}>Open</SecondaryButton>
                </div>
              ))}
            </div>
          )}
        </VtPanel>
      ) : null}

      {message ? <p style={{ margin: 0, color: cockpitColors.accent, fontSize: 13, fontWeight: 700 }}>{message}</p> : null}
      {error ? <p style={{ margin: 0, color: cockpitColors.critical, fontSize: 13, fontWeight: 700 }}>{error}</p> : null}

      <style>{`
        @media (max-width: 980px) {
          .vt-auto-builder { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </VtPage>
  );
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function pathNoteToStep(note: any): ActivityStep {
  const type = String(note?.type ?? "step");
  const label = String(note?.label ?? "").trim() || pathStepLabel(type, note);
  if (note?.ok === false) {
    return {
      label,
      outcome: "failed",
      detail: String(note?.message ?? "").trim() || humanPathReason(String(note?.reason ?? "failed")),
    };
  }
  if (note?.deferred) {
    return {
      label,
      outcome: "deferred",
      detail: deferredPathDetail(String(note?.reason ?? "")),
    };
  }
  return {
    label,
    outcome: "succeeded",
    detail: note?.pipelineName
      ? `Added to ${note.pipelineName}`
      : note?.title
        ? String(note.title)
        : "Completed",
  };
}

function plannedPathSteps(pathPres: any): Array<{ label: string; deferred: boolean }> {
  const rawSteps = Array.isArray(pathPres?.steps) ? pathPres.steps : [];
  return rawSteps
    .filter((step: any) => step && step.enabled !== false)
    .slice()
    .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
    .map((step: any) => {
      const type = String(step.type ?? "create_draft");
      return {
        label: String(step.label ?? "").trim() || pathStepLabel(type, step),
        deferred: type === "send_email" || type === "send_sms" || type === "notify_team" || type === "create_draft",
      };
    });
}

function pathStepLabel(type: string, note?: any) {
  switch (type) {
    case "create_draft":
      return "Create draft";
    case "send_email":
      return "Email";
    case "send_sms":
      return "SMS";
    case "notify_team":
      return "Notify team";
    case "add_to_pipeline":
      return note?.pipelineLabel || note?.pipelineName
        ? `Update pipeline (${note.pipelineLabel || note.pipelineName})`
        : "Update pipeline";
    default:
      return type.replace(/_/g, " ");
  }
}

function humanPathReason(reason: string) {
  switch (reason) {
    case "crm_unavailable":
      return "CRM unavailable";
    case "no_pipeline":
      return "No pipeline found";
    case "unsupported_step":
      return "Unsupported step";
    case "awaiting_approval_or_draft":
    case "awaiting_owner_grant":
      return "Needs approval";
    case "email_not_connected":
      return "Business email not connected";
    case "sms_not_connected":
      return "SMS not connected";
    case "sms_a2p_incomplete":
      return "Finish SMS brand setup";
    case "channel_not_ready":
      return "Required channel not connected";
    default:
      return reason.replace(/_/g, " ");
  }
}

function deferredPathDetail(reason: string) {
  switch (reason) {
    case "awaiting_owner_grant":
    case "awaiting_approval_or_draft":
      return "Draft ready — approve before send";
    case "awaiting_owner_manual":
      return "Waiting for owner confirmation";
    case "auto_send_no_recipients":
      return "No recipient — add contact details";
    case "draft_auto":
      return "Draft created";
    default:
      return humanPathReason(reason || "Needs approval");
  }
}

function outcomeLabel(outcome: StepOutcome) {
  if (outcome === "succeeded") return "Succeeded";
  if (outcome === "deferred") return "Needs approval";
  return "Failed";
}

function outcomeColor(outcome: StepOutcome) {
  if (outcome === "succeeded") return cockpitColors.handled;
  if (outcome === "deferred") return cockpitColors.accent;
  return cockpitColors.critical;
}

function readTriggerObject(contractOrPresentation: any) {
  return contractOrPresentation?.trigger
    ?? contractOrPresentation?.automationPath?.trigger
    ?? null;
}

const titleStyle = {
  margin: 0,
  fontSize: "1.55rem",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: cockpitColors.textPrimary,
} as const;

const topBar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
  padding: "16px 18px",
  borderRadius: 16,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: "#fff",
  boxShadow: "0 4px 16px rgba(28,25,23,0.05)",
};

const nameBtn: CSSProperties = {
  marginTop: 4,
  border: "none",
  background: "transparent",
  padding: 0,
  display: "inline-flex",
  alignItems: "baseline",
  gap: 10,
  cursor: "pointer",
  fontSize: "1.45rem",
  fontWeight: 900,
  letterSpacing: "-0.03em",
  color: cockpitColors.textPrimary,
  textAlign: "left",
};

const builderGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
  gap: 14,
  alignItems: "start",
};

const chatPane: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: "linear-gradient(180deg, #f8faf9 0%, #fff 40%)",
  minHeight: 520,
  position: "sticky",
  top: 12,
};

const chatScroll: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: 280,
  maxHeight: 360,
  overflowY: "auto",
  padding: 4,
};

const pathPane: CSSProperties = {
  borderRadius: 16,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: "#f4f4f5",
  backgroundImage: "radial-gradient(rgba(28,25,23,0.08) 1px, transparent 1px)",
  backgroundSize: "16px 16px",
  padding: "28px 18px 40px",
  minHeight: 520,
};

function tabChip(active: boolean): CSSProperties {
  return {
    borderRadius: 999,
    border: active ? `2px solid ${cockpitColors.accent}` : `1px solid ${cockpitColors.panelBorder}`,
    background: active ? "linear-gradient(180deg, #0f766e, #115e59)" : "#fff",
    color: active ? "#fff" : cockpitColors.textPrimary,
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "8px 14px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}
