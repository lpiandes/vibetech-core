"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import {
  VtActiveToggle,
  VtCard,
  VtDock,
  VtDockLink,
  VtEmpty,
  VtHero,
  VtPage,
  VtPanel,
  VtStatusChip,
  vtInputStyle,
} from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

type Catalogs = {
  triggers: Array<{ id: string; label: string; eventType: string }>;
  actions: Array<{ id: string; label: string; blurb: string }>;
  conditionFields: Array<{ id: string; label: string }>;
  conditionOps: Array<{ id: string; label: string }>;
};

type Pipeline = { id: string; name: string; stages: Array<{ id: string; label: string }> };

type Step =
  | {
      id: string;
      type: "condition";
      logic: "and" | "or";
      rules: Array<{ field: string; op: string; value: string }>;
      thenSteps: Step[];
      elseSteps: Step[];
    }
  | {
      id: string;
      type: "action";
      action: string;
      params: Record<string, unknown>;
      label?: string;
    };

type Workflow = {
  id: string;
  name: string;
  description?: string;
  status: "live" | "off";
  trigger: { type: string; eventType?: string; label?: string; config?: Record<string, string> };
  steps: Step[];
};

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function WorkflowAutomationsExperience({
  businessId,
  teammates = [],
}: {
  businessId: string;
  teammates?: Array<{
    employeeId: string;
    label: string;
    active: boolean;
    href: string;
    stepCount: number;
  }>;
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Workflow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string | null>(null);
  const [teammateRows, setTeammateRows] = useState(teammates);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chat, setChat] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: "Tell me what this automation should do — e.g. “When a form is submitted, tag vip and add to pipeline Sales → New, then create a follow-up.” I’ll update the builder.",
    },
  ]);

  const selected = useMemo(
    () => workflows.find((w) => w.id === selectedId) ?? null,
    [workflows, selectedId],
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/workflows`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not load automations");
    setWorkflows(data.workflows ?? []);
    setCatalogs(data.catalogs ?? null);
    setPipelines(data.pipelines ?? []);
    return data.workflows as Workflow[];
  }, [businessId]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [load]);

  useEffect(() => {
    setTeammateRows(teammates);
  }, [teammates]);

  useEffect(() => {
    if (selected) setDraft(JSON.parse(JSON.stringify(selected)));
    else setDraft(null);
  }, [selectedId, selected]);

  const liveCount = workflows.filter((w) => w.status === "live").length;

  async function api(body: Record<string, unknown>) {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/workflows`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function createWorkflow() {
    setBusy(true);
    setError(null);
    try {
      const data = await api({ action: "create", name: "New automation", triggerType: "form_submit" });
      setWorkflows(data.workflows ?? []);
      if (data.workflow?.id) setSelectedId(data.workflow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api({ action: "save", workflow: draft });
      setWorkflows(data.workflows ?? []);
      setTestLog("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(wf: Workflow) {
    setBusy(true);
    setError(null);
    try {
      const data = await api({
        action: "set_status",
        workflowId: wf.id,
        status: wf.status === "live" ? "off" : "live",
      });
      setWorkflows(data.workflows ?? []);
      if (draft?.id === wf.id) {
        setDraft({ ...draft, status: wf.status === "live" ? "off" : "live" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeWorkflow(id: string) {
    if (!window.confirm("Delete this automation?")) return;
    setBusy(true);
    try {
      const data = await api({ action: "delete", workflowId: id });
      setWorkflows(data.workflows ?? []);
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function testRun() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setTestLog(null);
    try {
      await api({ action: "save", workflow: draft });
      const data = await api({ action: "test_run", workflowId: draft.id });
      const log = data.result?.log ?? [];
      setTestLog(
        log.length
          ? log.map((l: any) => `${l.type}${l.action ? `:${l.action}` : ""} → ${l.passed != null ? (l.passed ? "yes" : "no") : (l.ok ? "ok" : l.reason || "done")}`).join("\n")
          : JSON.stringify(data.result, null, 2),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(patch: Partial<Workflow>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
  }

  function addActionStep() {
    if (!draft) return;
    setDraft({
      ...draft,
      steps: [
        ...draft.steps,
        {
          id: newId("step"),
          type: "action",
          action: "create_work",
          params: { title: "Follow up", brief: "Created by automation" },
        },
      ],
    });
  }

  function addConditionStep() {
    if (!draft) return;
    setDraft({
      ...draft,
      steps: [
        ...draft.steps,
        {
          id: newId("step"),
          type: "condition",
          logic: "and",
          rules: [{ field: "contact.kind", op: "equals", value: "lead" }],
          thenSteps: [
            {
              id: newId("step"),
              type: "action",
              action: "create_work",
              params: { title: "If yes — follow up", brief: "Condition matched" },
            },
          ],
          elseSteps: [
            {
              id: newId("step"),
              type: "action",
              action: "tag_contact",
              params: { tags: ["skipped_by_automation"] },
            },
          ],
        },
      ],
    });
  }

  function updateStep(index: number, next: Step) {
    if (!draft) return;
    const steps = [...draft.steps];
    steps[index] = next;
    setDraft({ ...draft, steps });
  }

  function removeStep(index: number) {
    if (!draft) return;
    setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) });
  }

  async function sendChat(apply: boolean) {
    const instruction = chatInput.trim();
    if (!instruction) return;
    setChat((prev) => [...prev, { role: "user", text: instruction }]);
    setChatInput("");
    setChatBusy(true);
    setError(null);
    try {
      let targetId = draft?.id || selectedId;
      const workingDraft = draft;
      if (!targetId) {
        const created = await api({ action: "create", name: "New automation", triggerType: "form_submit" });
        setWorkflows(created.workflows ?? []);
        targetId = created.workflow?.id;
        if (targetId) setSelectedId(targetId);
      } else if (workingDraft) {
        await api({ action: "save", workflow: workingDraft });
      }

      const data = await api({
        action: apply ? "propose_apply" : "propose",
        instruction,
        workflowId: targetId,
        apply,
      });
      const summary = String(data.proposal?.summary ?? (apply ? "Updated." : "Preview ready."));
      const source = data.proposal?.source ? ` (${data.proposal.source})` : "";
      if (apply) {
        setWorkflows(data.workflows ?? []);
        if (data.workflow) {
          setSelectedId(data.workflow.id);
          setDraft(JSON.parse(JSON.stringify(data.workflow)));
        }
        setChat((prev) => [...prev, { role: "assistant", text: `Applied${source}: ${summary}` }]);
        setTestLog(`AI applied: ${summary}`);
      } else {
        const preview = data.proposal?.proposedWorkflow;
        if (preview) setDraft(JSON.parse(JSON.stringify(preview)));
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Preview${source}: ${summary} — click Apply change to save, or tweak the builder.`,
          },
        ]);
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not update automation";
      setError(text);
      setChat((prev) => [...prev, { role: "assistant", text }]);
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <VtPage>
      <VtHero
        eyebrow="Mission · Automations"
        title="Workflows"
        right={<VtStatusChip label={`${liveCount} LIVE`} tone={liveCount > 0 ? "live" : "off"} />}
      >
        <VtDock>
          <VtDockLink href={`/b/${encodeURIComponent(businessId)}/people`}>People</VtDockLink>
          <VtDockLink href={`/b/${encodeURIComponent(businessId)}/pipelines`}>Pipelines</VtDockLink>
          <VtDockLink href={`/b/${encodeURIComponent(businessId)}/work`}>Work</VtDockLink>
          <button type="button" onClick={() => void createWorkflow()} style={dockBtn} disabled={busy}>
            + New automation
          </button>
        </VtDock>
      </VtHero>

      <p style={{ margin: 0, color: cockpitColors.textSecondary, fontWeight: 650, fontSize: 14 }}>
        Build If This → Then That automations — or type what you want in the AI box on this screen.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 240px) minmax(0, 1fr) minmax(260px, 320px)", gap: 12 }} className="wf-grid">
        <VtPanel title="Your automations">
          {workflows.length === 0 ? <VtEmpty label="No automations yet" /> : null}
          <div style={{ display: "grid", gap: 8 }}>
            {workflows.map((wf) => (
              <button
                key={wf.id}
                type="button"
                onClick={() => setSelectedId(wf.id)}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: `1px solid ${selectedId === wf.id ? cockpitColors.accent : cockpitColors.panelBorder}`,
                  background: selectedId === wf.id ? "linear-gradient(165deg, #ecfdf5, #fff)" : "#fff",
                  padding: 12,
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <div style={{ fontWeight: 850 }}>{wf.name}</div>
                <div style={{ fontSize: 12, color: cockpitColors.textSecondary, marginTop: 4, fontWeight: 650 }}>
                  {wf.trigger?.label || wf.trigger?.type} · {wf.steps?.length ?? 0} steps
                </div>
                <div style={{ marginTop: 8 }}>
                  <VtStatusChip label={wf.status === "live" ? "LIVE" : "OFF"} tone={wf.status === "live" ? "live" : "off"} />
                </div>
              </button>
            ))}
          </div>
        </VtPanel>

        <VtPanel title={draft ? "Builder" : "Pick an automation"}>
          {!draft ? (
            <VtEmpty label="Select an automation, create one, or type in the AI box" />
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  style={vtInputStyle}
                  placeholder="Automation name"
                />
                <VtActiveToggle
                  active={draft.status === "live"}
                  busy={busy}
                  onClick={() => void toggleStatus(draft)}
                  activeLabel="LIVE"
                  inactiveLabel="OFF"
                />
              </div>

              <label style={labelStyle}>
                When this happens (trigger)
                <select
                  value={draft.trigger.type}
                  onChange={(e) => {
                    const t = catalogs?.triggers.find((x) => x.id === e.target.value);
                    updateDraft({
                      trigger: {
                        type: e.target.value,
                        eventType: t?.eventType,
                        label: t?.label,
                        config: draft.trigger.config || {},
                      },
                    });
                  }}
                  style={vtInputStyle}
                >
                  {(catalogs?.triggers ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>

              {draft.trigger.type === "pipeline_stage" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={labelStyle}>
                    Only this pipeline (optional)
                    <select
                      value={draft.trigger.config?.pipelineId || ""}
                      onChange={(e) => updateDraft({
                        trigger: {
                          ...draft.trigger,
                          config: { ...(draft.trigger.config || {}), pipelineId: e.target.value },
                        },
                      })}
                      style={vtInputStyle}
                    >
                      <option value="">Any pipeline</option>
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <label style={labelStyle}>
                    Only this stage (optional)
                    <select
                      value={draft.trigger.config?.stageId || ""}
                      onChange={(e) => updateDraft({
                        trigger: {
                          ...draft.trigger,
                          config: { ...(draft.trigger.config || {}), stageId: e.target.value },
                        },
                      })}
                      style={vtInputStyle}
                    >
                      <option value="">Any stage</option>
                      {(pipelines.find((p) => p.id === draft.trigger.config?.pipelineId)?.stages
                        ?? pipelines.flatMap((p) => p.stages)).map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <SecondaryButton onClick={addActionStep}>+ Action</SecondaryButton>
                <SecondaryButton onClick={addConditionStep}>+ If / Else</SecondaryButton>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {draft.steps.map((step, index) => (
                  <StepEditor
                    key={step.id}
                    step={step}
                    catalogs={catalogs}
                    pipelines={pipelines}
                    workflows={workflows.filter((w) => w.id !== draft.id)}
                    onChange={(next) => updateStep(index, next)}
                    onRemove={() => removeStep(index)}
                  />
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <PrimaryButton onClick={() => void saveDraft()} disabled={busy}>Save</PrimaryButton>
                <SecondaryButton onClick={() => void testRun()} disabled={busy}>Test run</SecondaryButton>
                <SecondaryButton onClick={() => void removeWorkflow(draft.id)} disabled={busy}>Delete</SecondaryButton>
              </div>

              {testLog ? (
                <pre style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 10,
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                }}
                >
                  {testLog}
                </pre>
              ) : null}
            </div>
          )}
        </VtPanel>

        <VtPanel title="Type to change">
          <div style={{ display: "grid", gap: 10, minHeight: 360 }}>
            <div style={{
              display: "grid",
              gap: 8,
              maxHeight: 420,
              overflow: "auto",
              padding: 4,
            }}
            >
              {chat.map((msg, i) => (
                <div
                  key={`${msg.role}_${i}`}
                  style={{
                    justifySelf: msg.role === "user" ? "end" : "start",
                    maxWidth: "95%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: msg.role === "user" ? "linear-gradient(165deg, #ecfdf5, #d1fae5)" : "#f8fafc",
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    fontSize: 13,
                    fontWeight: 650,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat(true);
                }
              }}
              placeholder={draft
                ? `Change “${draft.name}”…`
                : "Describe a new automation…"}
              rows={3}
              disabled={chatBusy}
              style={{ ...vtInputStyle, resize: "vertical", minHeight: 72 }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <PrimaryButton onClick={() => void sendChat(true)} disabled={chatBusy || !chatInput.trim()}>
                {chatBusy ? "Working…" : "Apply change"}
              </PrimaryButton>
              <SecondaryButton onClick={() => void sendChat(false)} disabled={chatBusy || !chatInput.trim()}>
                Preview
              </SecondaryButton>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted, fontWeight: 650 }}>
              Examples: “When Meta lead comes in, tag hot_lead and add to Sales.” · “If contact is lead then create follow-up else tag skipped.” · “Go live.”
            </p>
          </div>
        </VtPanel>
      </div>

      {teammateRows.length > 0 ? (
        <VtPanel title="AI teammate paths (still available)">
          <div style={{ display: "grid", gap: 8 }}>
            {teammateRows.map((row) => (
              <VtCard key={row.employeeId} padding={12} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{row.label}</div>
                  <div style={{ fontSize: 12, color: cockpitColors.textSecondary }}>{row.stepCount} steps</div>
                </div>
                <SecondaryButton href={row.href}>Open path</SecondaryButton>
              </VtCard>
            ))}
          </div>
        </VtPanel>
      ) : null}

      {error ? <p style={{ color: cockpitColors.critical, fontWeight: 800 }}>{error}</p> : null}
      <style>{`
        @media (max-width: 1100px) {
          .wf-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </VtPage>
  );
}

function StepEditor({
  step,
  catalogs,
  pipelines,
  workflows,
  onChange,
  onRemove,
}: {
  step: Step;
  catalogs: Catalogs | null;
  pipelines: Pipeline[];
  workflows: Workflow[];
  onChange: (s: Step) => void;
  onRemove: () => void;
}) {
  if (step.type === "condition") {
    return (
      <VtCard padding={12} style={{ borderLeft: `4px solid ${cockpitColors.accent}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <strong>If / Else</strong>
          <button type="button" onClick={onRemove} style={linkBtn}>Remove</button>
        </div>
        <label style={labelStyle}>
          Match
          <select
            value={step.logic}
            onChange={(e) => onChange({ ...step, logic: e.target.value === "or" ? "or" : "and" })}
            style={vtInputStyle}
          >
            <option value="and">All rules (AND)</option>
            <option value="or">Any rule (OR)</option>
          </select>
        </label>
        {(step.rules ?? []).map((rule, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr", gap: 6, marginTop: 6 }}>
            <select
              value={rule.field}
              onChange={(e) => {
                const rules = [...step.rules];
                rules[i] = { ...rule, field: e.target.value };
                onChange({ ...step, rules });
              }}
              style={vtInputStyle}
            >
              {(catalogs?.conditionFields ?? []).map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            <select
              value={rule.op}
              onChange={(e) => {
                const rules = [...step.rules];
                rules[i] = { ...rule, op: e.target.value };
                onChange({ ...step, rules });
              }}
              style={vtInputStyle}
            >
              {(catalogs?.conditionOps ?? []).map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <input
              value={String(rule.value ?? "")}
              onChange={(e) => {
                const rules = [...step.rules];
                rules[i] = { ...rule, value: e.target.value };
                onChange({ ...step, rules });
              }}
              placeholder="Value"
              style={vtInputStyle}
            />
          </div>
        ))}
        <button
          type="button"
          style={{ ...linkBtn, marginTop: 8 }}
          onClick={() => onChange({
            ...step,
            rules: [...step.rules, { field: "contact.kind", op: "equals", value: "" }],
          })}
        >
          + Rule
        </button>
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: cockpitColors.textMuted }}>THEN</div>
        <ActionMiniList
          steps={step.thenSteps}
          catalogs={catalogs}
          pipelines={pipelines}
          workflows={workflows}
          onChange={(thenSteps) => onChange({ ...step, thenSteps })}
        />
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: cockpitColors.textMuted }}>ELSE</div>
        <ActionMiniList
          steps={step.elseSteps}
          catalogs={catalogs}
          pipelines={pipelines}
          workflows={workflows}
          onChange={(elseSteps) => onChange({ ...step, elseSteps })}
        />
      </VtCard>
    );
  }

  return (
    <VtCard padding={12}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <strong>Action</strong>
        <button type="button" onClick={onRemove} style={linkBtn}>Remove</button>
      </div>
      <ActionFields
        step={step}
        catalogs={catalogs}
        pipelines={pipelines}
        workflows={workflows}
        onChange={onChange}
      />
    </VtCard>
  );
}

function ActionMiniList({
  steps,
  catalogs,
  pipelines,
  workflows,
  onChange,
}: {
  steps: Step[];
  catalogs: Catalogs | null;
  pipelines: Pipeline[];
  workflows: Workflow[];
  onChange: (s: Step[]) => void;
}) {
  const actions = (steps ?? []).filter((s) => s.type === "action") as Extract<Step, { type: "action" }>[];
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {actions.map((step, i) => (
        <ActionFields
          key={step.id}
          step={step}
          catalogs={catalogs}
          pipelines={pipelines}
          workflows={workflows}
          onChange={(next) => {
            const copy = [...actions];
            copy[i] = next as Extract<Step, { type: "action" }>;
            onChange(copy);
          }}
        />
      ))}
      <button
        type="button"
        style={linkBtn}
        onClick={() => onChange([
          ...actions,
          {
            id: newId("step"),
            type: "action",
            action: "create_work",
            params: { title: "Follow up" },
          },
        ])}
      >
        + Action here
      </button>
    </div>
  );
}

function ActionFields({
  step,
  catalogs,
  pipelines,
  workflows,
  onChange,
}: {
  step: Extract<Step, { type: "action" }>;
  catalogs: Catalogs | null;
  pipelines: Pipeline[];
  workflows: Workflow[];
  onChange: (s: Step) => void;
}) {
  const params = step.params || {};
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <select
        value={step.action}
        onChange={(e) => onChange({ ...step, action: e.target.value, params: {} })}
        style={vtInputStyle}
      >
        {(catalogs?.actions ?? []).map((a) => (
          <option key={a.id} value={a.id}>{a.label}</option>
        ))}
      </select>

      {step.action === "add_to_pipeline" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <select
            value={String(params.pipelineId || "")}
            onChange={(e) => onChange({ ...step, params: { ...params, pipelineId: e.target.value } })}
            style={vtInputStyle}
          >
            <option value="">Default pipeline</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={String(params.stageId || "")}
            onChange={(e) => onChange({ ...step, params: { ...params, stageId: e.target.value } })}
            style={vtInputStyle}
          >
            <option value="">First stage</option>
            {(pipelines.find((p) => p.id === params.pipelineId)?.stages ?? pipelines[0]?.stages ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      {step.action === "tag_contact" ? (
        <input
          value={Array.isArray(params.tags) ? params.tags.join(", ") : String(params.tags || "")}
          onChange={(e) => onChange({ ...step, params: { ...params, tags: e.target.value } })}
          placeholder="Tags (comma-separated)"
          style={vtInputStyle}
        />
      ) : null}

      {step.action === "update_contact" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <select
            value={String(params.kind || "")}
            onChange={(e) => onChange({ ...step, params: { ...params, kind: e.target.value } })}
            style={vtInputStyle}
          >
            <option value="">Keep type</option>
            {["lead", "client", "family", "contractor", "vendor", "other"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input
            value={String(params.notes || "")}
            onChange={(e) => onChange({ ...step, params: { ...params, notes: e.target.value } })}
            placeholder="Add note"
            style={vtInputStyle}
          />
        </div>
      ) : null}

      {(step.action === "create_work" || step.action === "notify_team") ? (
        <div style={{ display: "grid", gap: 8 }}>
          <input
            value={String(params.title || "")}
            onChange={(e) => onChange({ ...step, params: { ...params, title: e.target.value } })}
            placeholder="Work title"
            style={vtInputStyle}
          />
          <input
            value={String(params.brief || "")}
            onChange={(e) => onChange({ ...step, params: { ...params, brief: e.target.value } })}
            placeholder="Brief"
            style={vtInputStyle}
          />
        </div>
      ) : null}

      {step.action === "run_workflow" ? (
        <select
          value={String(params.workflowId || "")}
          onChange={(e) => onChange({ ...step, params: { ...params, workflowId: e.target.value } })}
          style={vtInputStyle}
        >
          <option value="">Choose automation…</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 800,
  color: cockpitColors.textMuted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const linkBtn = {
  border: "none",
  background: "transparent",
  color: cockpitColors.accent,
  fontWeight: 800,
  cursor: "pointer",
  padding: 0,
  font: "inherit",
  fontSize: 13,
} as const;

const dockBtn = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(0,0,0,0.22)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  cursor: "pointer",
};
