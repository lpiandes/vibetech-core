"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { cockpitColors, spacing, radius } from "@/design/tokens";
import {
  builderCanvas,
  builderCard,
  builderInput,
  builderMuted,
  builderPanel,
  builderTitle,
  primaryButton,
  secondaryButton,
  statusTone,
} from "./builderTheme";

type ProposalViewKey =
  | "overview"
  | "navigation"
  | "dashboard"
  | "workflows"
  | "digitalWorkforce"
  | "rolesAccess"
  | "communications"
  | "campaigns"
  | "knowledge"
  | "integrations"
  | "reports"
  | "readiness"
  | "capabilityGaps";

const VIEW_LABELS: Record<ProposalViewKey, string> = {
  overview: "Overview",
  navigation: "Main workspaces",
  dashboard: "Dashboard",
  workflows: "Workflows",
  digitalWorkforce: "Digital Workforce",
  rolesAccess: "Roles & access",
  communications: "Communications",
  campaigns: "Campaigns",
  knowledge: "Knowledge",
  integrations: "Integrations",
  reports: "Reports",
  readiness: "Readiness",
  capabilityGaps: "Missing capabilities",
};

/**
 * Magic Builder workspace: conversation, research, uploads, proposal, portal preview.
 */
export default function BuilderWorkspace({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [journey, setJourney] = useState<any>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [researchFindings, setResearchFindings] = useState<any>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [changeImpact, setChangeImpact] = useState<any>(null);
  const [portalPreview, setPortalPreview] = useState<any>(null);
  const [previewRole, setPreviewRole] = useState<"OWNER" | "MANAGER" | "EMPLOYEE">("OWNER");
  const [centerMode, setCenterMode] = useState<"proposal" | "portal">("proposal");
  const [activeView, setActiveView] = useState<ProposalViewKey>("overview");
  const [message, setMessage] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [researchBusy, setResearchBusy] = useState(false);
  const [accentColor, setAccentColor] = useState("#0F766E");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(action?: string, body: Record<string, unknown> = {}) {
    const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
      method: action ? "POST" : "GET",
      headers: action ? { "content-type": "application/json" } : undefined,
      body: action ? JSON.stringify({ action, ...body }) : undefined,
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error ?? data.reason ?? data.message ?? "Something went wrong.");
    }
    if (data.session) setSession(data.session);
    if (data.proposal) setProposal(data.proposal);
    if (data.journey) setJourney(data.journey);
    if (data.quickReplies) setQuickReplies(data.quickReplies);
    if (data.researchFindings !== undefined) setResearchFindings(data.researchFindings);
    if (data.uploads) setUploads(data.uploads);
    if (data.changeImpact) setChangeImpact(data.changeImpact);
    if (data.session?.appearance?.accentColor) setAccentColor(data.session.appearance.accentColor);
    if (data.session?.questions?.[0] && !action) {
      setQuickReplies(data.quickReplies ?? []);
    }
    return data;
  }

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load session.");
      }
    })();
  }, [sessionId]);

  const accent = proposal?.accentColor ?? accentColor;
  const conversation = session?.conversation ?? [];
  const nextQuestion = session?.questions?.[0] ?? null;
  const view = proposal?.views?.[activeView];

  const stageChips = useMemo(() => journey?.stages ?? [], [journey]);

  async function send(override?: string, opts: { unknown?: boolean; skipped?: boolean } = {}) {
    const text = (override ?? message).trim();
    setBusy(true);
    setError(null);
    try {
      if (nextQuestion && !proposal) {
        await refresh("answer", {
          questionId: nextQuestion.questionId,
          answer: text || "I don't know",
          unknown: opts.unknown || !text,
          skipped: Boolean(opts.skipped),
        });
        const workspace = await refresh();
        setQuickReplies(workspace.quickReplies ?? []);
      } else {
        const data = await refresh("chat", { text });
        setChangeImpact(data.changeImpact ?? null);
      }
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  async function propose() {
    setBusy(true);
    setError(null);
    try {
      await refresh("propose");
      setCenterMode("proposal");
      setActiveView("overview");
      setChangeImpact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not propose.");
    } finally {
      setBusy(false);
    }
  }

  async function runResearch() {
    setResearchBusy(true);
    setError(null);
    try {
      await refresh("research", { websiteUrl: websiteUrl || session?.websiteUrls?.[0] });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed. You can continue without it.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function confirmResearch(accepted: boolean) {
    setBusy(true);
    try {
      await refresh("confirm_research", { accepted });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save research decision.");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const textPreview = file.type.startsWith("text") || /\.(csv|md|txt|json)$/i.test(file.name)
          ? await file.text().then((text) => text.slice(0, 4000)).catch(() => "")
          : "";
        await refresh("upload", {
          filename: file.name,
          mimeType: file.type,
          textPreview,
          notes: "Uploaded during Builder discovery",
        });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadPortal(role = previewRole) {
    setBusy(true);
    setError(null);
    try {
      const data = await refresh("portal_preview", { membershipRole: role });
      setPortalPreview(data);
      setCenterMode("portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build preview.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAccent(next: string) {
    setAccentColor(next);
    await refresh("update_appearance", { accentColor: next });
  }

  async function renameModule(moduleId: string, label: string) {
    const overrides = {
      ...(session?.appearance?.navigationOverrides ?? {}),
      labels: {
        ...(session?.appearance?.navigationOverrides?.labels ?? {}),
        [moduleId]: label,
      },
    };
    await refresh("update_appearance", { navigationOverrides: overrides });
    if (centerMode === "portal") await loadPortal(previewRole);
  }

  return (
    <div style={builderCanvas}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(300px, 1fr) minmax(440px, 1.45fr) minmax(260px, 0.9fr)",
        gap: spacing.lg,
        maxWidth: 1480,
        margin: "0 auto",
        padding: spacing.xl,
      }}>
        <section style={{ ...builderPanel, display: "grid", gridTemplateRows: "auto auto 1fr auto", minHeight: 720 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Ask VIBETech
            </div>
            <h1 style={{ ...builderTitle, fontSize: "1.35rem", marginTop: 6 }}>Business Builder</h1>
            <p style={builderMuted}>Like an expert consultant — one useful question at a time.</p>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: `${spacing.md} 0` }}>
            {stageChips.map((stage: any) => {
              const tone = statusTone(stage.status);
              return (
                <span key={stage.id} style={{ ...tone, borderRadius: 99, padding: "4px 10px", fontSize: 12, fontWeight: 650 }}>
                  {stage.label}
                </span>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: spacing.sm, overflow: "auto", paddingRight: 4, alignContent: "start" }}>
            {conversation.map((entry: any) => (
              <div
                key={entry.messageId}
                style={{
                  justifySelf: entry.role === "user" ? "end" : "start",
                  maxWidth: "92%",
                  background: entry.role === "user" ? accent : "#fff",
                  color: entry.role === "user" ? "#fff" : cockpitColors.textPrimary,
                  border: entry.role === "user" ? "none" : `1px solid ${cockpitColors.panelBorder}`,
                  borderRadius: radius.large,
                  padding: `${spacing.sm} ${spacing.md}`,
                }}
              >
                {entry.text}
                {entry.metadata?.why ? (
                  <div style={{ marginTop: 6, opacity: 0.85, fontSize: 12 }}>Why this matters: {entry.metadata.why}</div>
                ) : null}
              </div>
            ))}

            <ResearchBlock
              websiteUrl={websiteUrl}
              setWebsiteUrl={setWebsiteUrl}
              researchBusy={researchBusy}
              findings={researchFindings}
              onResearch={() => void runResearch()}
              onConfirm={(accepted) => void confirmResearch(accepted)}
              onSkip={() => void confirmResearch(false)}
            />

            <UploadBlock uploads={uploads} onUpload={onUpload} />

            {changeImpact ? (
              <div style={{ ...builderCard, borderColor: "#FDBA74", background: "#FFF7ED" }}>
                <strong>Proposed change</strong>
                <p style={builderMuted}>{changeImpact.explanation}</p>
                <p style={builderMuted}>Risk: {changeImpact.risk} · Dry run and approval required</p>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: spacing.sm, marginTop: spacing.md }}>
            {nextQuestion && !proposal ? (
              <div style={{ ...builderMuted, fontSize: 13 }}>
                Next: {nextQuestion.prompt}
              </div>
            ) : (
              <div style={{ ...builderMuted, fontSize: 13 }}>
                Ask for a change, or continue to dry run when ready.
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {quickReplies.map((reply) => (
                <button key={reply} type="button" style={secondaryButton} disabled={busy} onClick={() => void send(reply, { unknown: /don.?t know/i.test(reply), skipped: /skip/i.test(reply) })}>
                  {reply}
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={proposal ? "Add a scheduling workspace…" : "Type your answer…"}
              rows={3}
              style={{ ...builderInput, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void send()} disabled={busy} style={primaryButton(accent)}>Send</button>
              <button type="button" onClick={() => void send("I don't know", { unknown: true })} disabled={busy} style={secondaryButton}>I don't know</button>
              <button type="button" onClick={() => void send("Skip for now", { skipped: true })} disabled={busy} style={secondaryButton}>Skip</button>
              <button type="button" onClick={() => void propose()} disabled={busy} style={secondaryButton}>Propose OS</button>
            </div>
          </div>
        </section>

        <section style={{ ...builderPanel, minHeight: 720 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: cockpitColors.textMuted }}>
                {centerMode === "portal" ? "Live portal preview" : "Visual Business OS proposal"}
              </div>
              <h2 style={{ ...builderTitle, fontSize: "1.35rem", marginTop: 4 }}>
                {proposal?.businessName ?? session?.businessSummary?.businessName ?? "Your Business OS"}
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={accent} onChange={(event) => void saveAccent(event.target.value)} title="Accent color" />
              <button type="button" style={centerMode === "proposal" ? primaryButton(accent) : secondaryButton} onClick={() => setCenterMode("proposal")}>Proposal</button>
              <button type="button" style={centerMode === "portal" ? primaryButton(accent) : secondaryButton} disabled={!proposal} onClick={() => void loadPortal(previewRole)}>Portal preview</button>
            </div>
          </div>

          {centerMode === "proposal" ? (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: spacing.md }}>
                {(Object.keys(VIEW_LABELS) as ProposalViewKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveView(key)}
                    style={{
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      borderRadius: 99,
                      padding: "6px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                      background: activeView === key ? accent : "#fff",
                      color: activeView === key ? "#fff" : cockpitColors.textPrimary,
                    }}
                  >
                    {VIEW_LABELS[key]}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: spacing.lg, display: "grid", gap: spacing.md }}>
                {!proposal ? (
                  <div style={{ ...builderCard, color: cockpitColors.textMuted }}>
                    Answer a few questions, add a website or files if you like, then propose your operating system.
                  </div>
                ) : (
                  <>
                    <h3 style={{ margin: 0 }}>{view?.title ?? VIEW_LABELS[activeView]}</h3>
                    {view?.headline ? <p style={builderMuted}>{view.headline}</p> : null}
                    <div style={{ display: "grid", gap: spacing.sm }}>
                      {(view?.items ?? view?.cards ?? view?.bullets ?? []).map((item: any, index: number) => (
                        <ProposalCard
                          key={item.id ?? item.label ?? index}
                          item={item}
                          activeView={activeView}
                          onRename={activeView === "navigation" ? renameModule : undefined}
                        />
                      ))}
                      {view?.overflow?.length ? <div style={builderMuted}>More: {view.overflow.join(" · ")}</div> : null}
                      {view?.note ? <div style={builderMuted}>{view.note}</div> : null}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <PortalPreviewPanel
              preview={portalPreview}
              previewRole={previewRole}
              accent={accent}
              onRole={(role) => {
                setPreviewRole(role);
                void loadPortal(role);
              }}
            />
          )}
        </section>

        <aside style={{ ...builderPanel, minHeight: 720, display: "grid", alignContent: "start", gap: spacing.md }}>
          <h3 style={{ margin: 0 }}>Progress</h3>
          <ProgressBar value={session?.progress?.percent ?? journey?.percent ?? 0} accent={accent} />
          <p style={builderMuted}>{journey?.activeStageLabel ?? session?.progress?.label ?? "Getting started"}</p>

          <h4 style={{ margin: 0 }}>Next action</h4>
          <p style={builderMuted}>{proposal?.nextAction ?? nextQuestion?.prompt ?? "Tell us about your business."}</p>

          <h4 style={{ margin: 0 }}>Assumptions</h4>
          <ul style={listStyle}>
            {(proposal?.assumptions ?? session?.assumptions ?? []).slice(0, 6).map((entry: any, index: number) => (
              <li key={entry.assumptionId ?? entry.id ?? index}>{entry.text ?? entry}</li>
            ))}
            {(proposal?.assumptions ?? session?.assumptions ?? []).length === 0 ? <li>None yet</li> : null}
          </ul>

          <h4 style={{ margin: 0 }}>Still open</h4>
          <ul style={listStyle}>
            {(proposal?.unresolvedQuestions ?? session?.unresolvedQuestions ?? []).length
              ? (proposal?.unresolvedQuestions ?? session?.unresolvedQuestions ?? []).slice(0, 6).map((id: string) => (
                <li key={id}>{String(id).replace(/^q_/, "").replace(/_/g, " ")}</li>
              ))
              : <li>None right now</li>}
          </ul>

          {error ? <div style={{ color: cockpitColors.warning }}>{error}</div> : null}

          <div style={{ display: "grid", gap: spacing.sm, marginTop: spacing.md }}>
            <button type="button" style={primaryButton(accent)} disabled={!proposal || busy} onClick={() => router.push(`/builder/${sessionId}/dry-run`)}>
              Continue to dry run
            </button>
            <button type="button" style={secondaryButton} onClick={() => router.push("/builder")}>
              Back to Builder home
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProposalCard({
  item,
  activeView,
  onRename,
}: {
  item: any;
  activeView: ProposalViewKey;
  onRename?: (moduleId: string, label: string) => void;
}) {
  const label = item.label ?? item.title ?? item;
  return (
    <div style={builderCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 650 }}>{label}</div>
        {item.status ? <StatusBadge status={item.status} /> : null}
        {item.kind ? <StatusBadge status={item.kind} /> : null}
      </div>
      {item.purpose ? <div style={{ ...builderMuted, marginTop: 6 }}>{item.purpose}</div> : null}
      {item.emptyState ? <div style={{ ...builderMuted, marginTop: 6 }}>{item.emptyState}</div> : null}
      {Array.isArray(item.responsibilities) && item.responsibilities.length ? (
        <div style={{ ...builderMuted, marginTop: 6 }}>Responsibilities: {item.responsibilities.join(" · ")}</div>
      ) : null}
      {Array.isArray(item.approvals) && item.approvals.length ? (
        <div style={{ marginTop: 8 }}><StatusBadge status="requires approval" /> {item.approvals.map(String).join(", ")}</div>
      ) : null}
      {item.approvalRequired ? <div style={{ marginTop: 8 }}><StatusBadge status="requires approval" /></div> : null}
      {Array.isArray(item.modules) ? <div style={{ ...builderMuted, marginTop: 6 }}>Sees: {item.modules.join(", ") || "—"}</div> : null}
      {Array.isArray(item.denied) && item.denied.length ? <div style={{ ...builderMuted, marginTop: 6 }}>Hidden: {item.denied.join(", ")}</div> : null}
      {item.readiness ? <div style={{ ...builderMuted, marginTop: 6 }}>Readiness: {item.readiness}</div> : null}
      {item.escalation ? <div style={{ ...builderMuted, marginTop: 6 }}>Escalation: {item.escalation}</div> : null}
      {activeView === "navigation" && onRename && item.id ? (
        <button
          type="button"
          style={{ ...secondaryButton, marginTop: 10, padding: "6px 10px", fontSize: 12 }}
          onClick={() => {
            const next = window.prompt("Rename this workspace", String(label));
            if (next?.trim()) onRename(String(item.id), next.trim());
          }}
        >
          Rename
        </button>
      ) : null}
    </div>
  );
}

function PortalPreviewPanel({
  preview,
  previewRole,
  accent,
  onRole,
}: {
  preview: any;
  previewRole: string;
  accent: string;
  onRole: (role: "OWNER" | "MANAGER" | "EMPLOYEE") => void;
}) {
  if (!preview?.ok) {
    return <div style={{ ...builderCard, marginTop: spacing.lg, color: cockpitColors.textMuted }}>Generate a proposal first, then preview the portal.</div>;
  }
  return (
    <div style={{ marginTop: spacing.lg, display: "grid", gap: spacing.md }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["OWNER", "MANAGER", "EMPLOYEE"] as const).map((role) => (
          <button key={role} type="button" style={previewRole === role ? primaryButton(accent) : secondaryButton} onClick={() => onRole(role)}>
            {role === "OWNER" ? "Owner view" : role === "MANAGER" ? "Manager view" : "Employee view"}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: spacing.md, minHeight: 420, border: `1px solid ${cockpitColors.panelBorder}`, borderRadius: radius.large, overflow: "hidden" }}>
        <div style={{ background: "#0B1220", color: "#E2E8F0", padding: spacing.md }}>
          <div style={{ fontWeight: 750, marginBottom: spacing.md, color: accent }}>{preview.appearance?.businessName}</div>
          {(preview.sidebar?.primary ?? []).map((item: any) => (
            <div key={item.moduleId} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{item.label}</div>
          ))}
          {preview.sidebar?.overflow?.length ? (
            <div style={{ marginTop: spacing.md, opacity: 0.7, fontSize: 13 }}>More · {preview.sidebar.overflow.join(" · ")}</div>
          ) : null}
        </div>
        <div style={{ padding: spacing.md, background: "#fff", display: "grid", gap: spacing.sm, alignContent: "start" }}>
          <div style={{ fontWeight: 700 }}>{preview.roleLabel} dashboard</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing.sm }}>
            {(preview.dashboard?.cards ?? []).map((card: any) => (
              <div key={card.id} style={builderCard}>
                <div style={{ fontWeight: 650 }}>{card.title}</div>
                <div style={builderMuted}>{card.emptyState ?? "No fabricated metrics — empty until real data exists."}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: spacing.sm }}>
            <div style={{ fontWeight: 650, marginBottom: 8 }}>Digital Workforce</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(preview.digitalWorkforce ?? []).slice(0, 4).map((employee: any) => (
                <div key={employee.name} style={builderCard}>
                  <strong>{employee.name}</strong>
                  <div style={builderMuted}>{employee.purpose}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResearchBlock({
  websiteUrl,
  setWebsiteUrl,
  researchBusy,
  findings,
  onResearch,
  onConfirm,
  onSkip,
}: {
  websiteUrl: string;
  setWebsiteUrl: (value: string) => void;
  researchBusy: boolean;
  findings: any;
  onResearch: () => void;
  onConfirm: (accepted: boolean) => void;
  onSkip: () => void;
}) {
  return (
    <div style={builderCard}>
      <strong>Website research</strong>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://yourcompany.com" style={builderInput} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={secondaryButton} disabled={researchBusy} onClick={onResearch}>
            {researchBusy ? "Researching…" : "Research website"}
          </button>
          <button type="button" style={secondaryButton} onClick={onSkip}>Continue without research</button>
        </div>
      </div>
      {findings ? (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          <StatusBadge status={findings.confirmationStatus ?? "pending"} />
          <div style={builderMuted}>Services: {(findings.services ?? []).join(", ") || "—"}</div>
          <div style={builderMuted}>Locations: {(findings.locations ?? []).join(", ") || "—"}</div>
          <div style={builderMuted}>Contacts: {(findings.contactMethods ?? []).join(", ") || "—"}</div>
          <div style={builderMuted}>Confidence: {findings.confidence ?? "medium"}</div>
          {findings.confirmationStatus === "pending" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={primaryButton()} onClick={() => onConfirm(true)}>Confirm findings</button>
              <button type="button" style={secondaryButton} onClick={() => onConfirm(false)}>Reject</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function UploadBlock({ uploads, onUpload }: { uploads: any[]; onUpload: (files: FileList | null) => void }) {
  return (
    <div style={builderCard}>
      <strong>Files & evidence</strong>
      <p style={{ ...builderMuted, marginTop: 6 }}>Drop SOPs, spreadsheets, CRM exports, or policies. Nothing mutates your business yet.</p>
      <label
        style={{
          ...builderCard,
          marginTop: 8,
          borderStyle: "dashed",
          textAlign: "center",
          cursor: "pointer",
          color: cockpitColors.textMuted,
        }}
      >
        Drag and drop or choose files
        <input type="file" multiple hidden onChange={(event) => onUpload(event.target.files)} />
      </label>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {uploads.map((upload) => (
          <div key={upload.artifactId} style={{ fontSize: 13 }}>
            <strong>{upload.filename}</strong>
            <div style={builderMuted}>
              Looks like: {String(upload.classification).replace(/_/g, " ")} · Planned use: {String(upload.plannedUse).replace(/_/g, " ")}
              {upload.mutatesCanonicalData ? "" : " · Non-mutating"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ value, accent }: { value: number; accent: string }) {
  return (
    <div style={{ height: 8, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: accent }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span style={{ ...tone, display: "inline-block", borderRadius: 99, padding: "2px 8px", fontSize: 12, fontWeight: 650 }}>
      {String(status).replace(/_/g, " ")}
    </span>
  );
}

const listStyle: CSSProperties = {
  paddingLeft: 18,
  margin: 0,
  color: cockpitColors.textMuted,
};
