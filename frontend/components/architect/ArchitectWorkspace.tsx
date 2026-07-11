"use client";

import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { architect } from "./architectTheme";
import {
  ArchitectBadge,
  ArchitectButton,
  ArchitectPanel,
  ArchitectShell,
  ArchitectSkeleton,
  ThinkingDots,
} from "./ArchitectPrimitives";
import {
  ARCHITECT_PREVIEW_ROLES,
  ARCHITECT_PROPOSAL_SECTIONS,
  architectRoutes,
  changeImpactCopy,
  confidenceLabel,
  detectUploadHint,
  discoveryProgress,
  humanizeToken,
  proposalSectionView,
  researchFindingCards,
} from "./architectSemantics";

type PreviewRole = "OWNER" | "MANAGER" | "EMPLOYEE";

/**
 * Premium Architect workspace — consultant conversation + visual proposal + portal preview.
 * Uses existing /api/builder session actions; no backend rewrite.
 */
export default function ArchitectWorkspace({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const routes = architectRoutes(sessionId);
  const [session, setSession] = useState<any>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [journey, setJourney] = useState<any>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [researchFindings, setResearchFindings] = useState<any>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [changeImpact, setChangeImpact] = useState<any>(null);
  const [portalPreview, setPortalPreview] = useState<any>(null);
  const [previewRole, setPreviewRole] = useState<PreviewRole>("OWNER");
  const [centerMode, setCenterMode] = useState<"discovery" | "proposal" | "portal">("discovery");
  const [activeSection, setActiveSection] = useState("overview");
  const [message, setMessage] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [researchBusy, setResearchBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [cardEdits, setCardEdits] = useState<Record<string, string>>({});
  const [accentColor, setAccentColor] = useState<string>(architect.accent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
    return data;
  }

  useEffect(() => {
    void (async () => {
      try {
        setThinking(true);
        const data = await refresh();
        if (data.proposal) setCenterMode("proposal");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load session.");
      } finally {
        setThinking(false);
      }
    })();
  }, [sessionId]);

  const accent = proposal?.accentColor ?? accentColor;
  const conversation = session?.conversation ?? [];
  const nextQuestion = session?.questions?.[0] ?? null;
  const answers = session?.answers ?? [];
  const progress = discoveryProgress(session);
  const confidence = confidenceLabel(
    proposal?.confidence ?? session?.progress?.confidence ?? researchFindings?.confidence ?? "medium",
  );
  const impact = changeImpactCopy(changeImpact);
  const { view: activeView } = proposalSectionView(activeSection, proposal);
  const researchCards = useMemo(() => researchFindingCards(researchFindings), [researchFindings]);

  async function send(override?: string, opts: { unknown?: boolean; skipped?: boolean } = {}) {
    const text = (override ?? message).trim();
    setBusy(true);
    setThinking(true);
    setError(null);
    try {
      const questionId = editingAnswerId ?? nextQuestion?.questionId;
      if (questionId && !proposal) {
        await refresh("answer", {
          questionId,
          answer: text || "I don't know",
          unknown: opts.unknown || !text,
          skipped: Boolean(opts.skipped),
        });
        setEditingAnswerId(null);
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
      setThinking(false);
    }
  }

  function goBack() {
    const last = answers[answers.length - 1];
    if (!last) return;
    setEditingAnswerId(last.questionId);
    setMessage(last.answer ? String(last.answer) : "");
    setCenterMode("discovery");
  }

  function editAnswer(answer: { questionId: string; answer?: string | null }) {
    setEditingAnswerId(answer.questionId);
    setMessage(answer.answer ? String(answer.answer) : "");
    setCenterMode("discovery");
  }

  async function propose() {
    setBusy(true);
    setThinking(true);
    setError(null);
    try {
      await refresh("propose");
      setCenterMode("proposal");
      setActiveSection("overview");
      setChangeImpact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not propose.");
    } finally {
      setBusy(false);
      setThinking(false);
    }
  }

  async function runResearch() {
    setResearchBusy(true);
    setThinking(true);
    setError(null);
    try {
      await refresh("research", { websiteUrl: websiteUrl || session?.websiteUrls?.[0] });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed. You can continue without it.");
    } finally {
      setResearchBusy(false);
      setThinking(false);
    }
  }

  async function confirmResearch(accepted: boolean) {
    setBusy(true);
    try {
      const fieldByCardId: Record<string, string> = {
        locations: "locations",
        services: "services",
        team: "teamHints",
        contact: "contactMethods",
        scheduling: "schedulingHints",
        faqs: "faqs",
      };
      const edits: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(cardEdits)) {
        if (!value.trim()) continue;
        const field = fieldByCardId[key] ?? key;
        edits[field] = value.split(",").map((part) => part.trim()).filter(Boolean);
      }
      await refresh("confirm_research", { accepted, edits });
      await refresh();
      setCardEdits({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save research decision.");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(files: FileList | File[] | null) {
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
          notes: "Uploaded during Architect discovery",
        });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      setDragOver(false);
    }
  }

  async function loadPortal(role: PreviewRole = previewRole) {
    setBusy(true);
    setThinking(true);
    setError(null);
    try {
      const data = await refresh("portal_preview", { membershipRole: role });
      setPortalPreview(data);
      setCenterMode("portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build preview.");
    } finally {
      setBusy(false);
      setThinking(false);
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

  function onDrop(event: DragEvent) {
    event.preventDefault();
    void onUpload(event.dataTransfer.files);
  }

  if (!session && !error) {
    return (
      <ArchitectShell maxWidth={1100}>
        <ArchitectPanel style={{ display: "grid", gap: 14 }}>
          <ThinkingDots label="Opening your Architect session" />
          <ArchitectSkeleton height={28} width="40%" />
          <ArchitectSkeleton height={120} />
          <ArchitectSkeleton height={220} />
        </ArchitectPanel>
      </ArchitectShell>
    );
  }

  return (
    <ArchitectShell maxWidth={1440}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <ArchitectBadge tone="accent">Ask VIBETech · Architect</ArchitectBadge>
          <h1 style={{
            margin: "10px 0 6px",
            fontFamily: architect.display,
            fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
            letterSpacing: "-0.02em",
          }}>
            {proposal?.businessName ?? session?.businessSummary?.businessName ?? "Designing your Business OS"}
          </h1>
          <p style={{ margin: 0, color: architect.inkMuted }}>
            One thoughtful question at a time. Nothing changes until you approve.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <ArchitectBadge tone={confidence.tone}>{confidence.label}</ArchitectBadge>
          <input
            type="color"
            value={accent}
            onChange={(event) => void saveAccent(event.target.value)}
            title="Accent color"
            aria-label="Accent color"
            style={{ width: 36, height: 36, border: "none", background: "transparent", cursor: "pointer" }}
          />
        </div>
      </header>

      <div className="architect-workspace-grid">
        {/* Left: discovery / conversation */}
        <ArchitectPanel style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: 720, gap: 14 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Discovery</h2>
              <span style={{ color: architect.inkMuted, fontSize: 13 }}>{progress.percent}%</span>
            </div>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${progress.percent}%`, background: accent }} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {(journey?.stages ?? []).map((stage: any) => (
                <ArchitectBadge key={stage.id} tone={stage.status === "complete" ? "success" : "neutral"}>
                  {stage.label}
                </ArchitectBadge>
              ))}
            </div>
          </div>

          <div style={{ overflow: "auto", display: "grid", gap: 12, alignContent: "start", paddingRight: 4 }}>
            {answers.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: architect.inkMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Previous answers
                </div>
                {answers.slice(-6).map((answer: any) => (
                  <button
                    key={answer.questionId}
                    type="button"
                    onClick={() => editAnswer(answer)}
                    style={answerChip}
                  >
                    <div style={{ fontWeight: 650 }}>{humanizeToken(answer.questionId.replace(/^q_/, ""))}</div>
                    <div style={{ color: architect.inkMuted, fontSize: 13 }}>
                      {answer.skipped ? "Skipped" : answer.unknown ? "I don't know" : String(answer.answer ?? "—")}
                    </div>
                    <div style={{ color: accent, fontSize: 12, marginTop: 4 }}>Edit</div>
                  </button>
                ))}
              </div>
            ) : null}

            {conversation.slice(-8).map((entry: any) => (
              <div
                key={entry.messageId}
                style={{
                  justifySelf: entry.role === "user" ? "end" : "start",
                  maxWidth: "94%",
                  background: entry.role === "user" ? accent : "rgba(15,23,42,.65)",
                  color: entry.role === "user" ? "#042F2E" : architect.ink,
                  borderRadius: 16,
                  padding: "12px 14px",
                  border: entry.role === "user" ? "none" : `1px solid ${architect.border}`,
                }}
              >
                {entry.text}
                {entry.metadata?.why ? (
                  <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>Why: {entry.metadata.why}</div>
                ) : null}
              </div>
            ))}

            {thinking ? <ThinkingDots /> : null}

            {nextQuestion && !proposal ? (
              <div style={{
                borderRadius: architect.radiusSm,
                border: `1px solid ${architect.border}`,
                padding: 16,
                background: architect.accentSoft,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 6 }}>
                  {editingAnswerId ? "Editing a previous answer" : "One question"}
                </div>
                <div style={{ fontSize: 17, fontWeight: 650, marginBottom: 8 }}>
                  {editingAnswerId
                    ? `Update: ${humanizeToken(editingAnswerId.replace(/^q_/, ""))}`
                    : nextQuestion.prompt}
                </div>
                {nextQuestion.why ? (
                  <div style={{ color: architect.inkMuted, fontSize: 13, lineHeight: 1.5 }}>
                    Why we ask: {nextQuestion.why}
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ color: architect.inkMuted, fontSize: 14 }}>
                Architect stays open. Ask for a change anytime — explain, preview, then approve.
              </div>
            )}

            {impact ? (
              <div style={{
                borderRadius: architect.radiusSm,
                border: "1px solid rgba(251,191,36,.35)",
                background: "rgba(251,191,36,.08)",
                padding: 14,
              }}>
                <strong>{impact.headline}</strong>
                <p style={{ margin: "8px 0", color: architect.inkMuted }}>{impact.explanation}</p>
                <p style={{ margin: 0, color: architect.inkMuted, fontSize: 13 }}>
                  Risk: {impact.risk} · Approval required before install
                </p>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {quickReplies.map((reply) => (
                <ArchitectButton
                  key={reply}
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void send(reply, { unknown: /don.?t know/i.test(reply), skipped: /skip/i.test(reply) })}
                >
                  {reply}
                </ArchitectButton>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={proposal ? "We opened another office…" : "Type your answer…"}
              rows={3}
              aria-label="Architect message"
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ArchitectButton disabled={busy} accent={accent} onClick={() => void send()}>
                {busy ? "Sending…" : proposal ? "Propose change" : "Continue"}
              </ArchitectButton>
              <ArchitectButton variant="secondary" disabled={busy} onClick={() => void send("I don't know", { unknown: true })}>
                I don&apos;t know
              </ArchitectButton>
              <ArchitectButton variant="secondary" disabled={busy} onClick={() => void send("Skip for now", { skipped: true })}>
                Skip
              </ArchitectButton>
              <ArchitectButton variant="ghost" disabled={busy || !answers.length} onClick={goBack}>
                Go back
              </ArchitectButton>
              <ArchitectButton variant="secondary" disabled={busy} onClick={() => void propose()}>
                Propose OS
              </ArchitectButton>
            </div>
          </div>
        </ArchitectPanel>

        {/* Center: research / proposal / portal */}
        <ArchitectPanel style={{ minHeight: 720, display: "grid", alignContent: "start", gap: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ArchitectButton
              variant={centerMode === "discovery" ? "primary" : "secondary"}
              accent={accent}
              onClick={() => setCenterMode("discovery")}
            >
              Research & files
            </ArchitectButton>
            <ArchitectButton
              variant={centerMode === "proposal" ? "primary" : "secondary"}
              accent={accent}
              onClick={() => setCenterMode("proposal")}
            >
              Proposal
            </ArchitectButton>
            <ArchitectButton
              variant={centerMode === "portal" ? "primary" : "secondary"}
              accent={accent}
              disabled={!proposal}
              onClick={() => void loadPortal(previewRole)}
            >
              Portal preview
            </ArchitectButton>
          </div>

          {centerMode === "discovery" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <section>
                <h3 style={{ marginTop: 0 }}>Website research</h3>
                <p style={{ color: architect.inkMuted, marginTop: 0 }}>
                  Architect gathers public signals, then you accept, reject, or edit each finding.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="https://yourcompany.com"
                    aria-label="Website URL"
                    style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                  />
                  <ArchitectButton disabled={researchBusy} accent={accent} onClick={() => void runResearch()}>
                    {researchBusy ? "Researching…" : "Research website"}
                  </ArchitectButton>
                  <ArchitectButton variant="secondary" onClick={() => void confirmResearch(false)}>
                    Continue without
                  </ArchitectButton>
                </div>
                {researchBusy ? (
                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    <ThinkingDots label="Reviewing the website" />
                    <ArchitectSkeleton height={64} />
                    <ArchitectSkeleton height={64} />
                  </div>
                ) : null}
                {researchCards.length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 14 }}>
                    {researchCards.map((card) => (
                      <div key={card.id} style={findingCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong>{card.status === "found" ? "✓ " : ""}{card.label}</strong>
                          <ArchitectBadge tone={card.status === "found" ? "success" : "neutral"}>
                            {card.status === "found" ? "Found" : "Empty"}
                          </ArchitectBadge>
                        </div>
                        <div style={{ color: architect.inkMuted, fontSize: 13, margin: "8px 0" }}>
                          {card.values.length ? card.values.join(" · ") : "Nothing detected yet"}
                        </div>
                        <input
                          value={cardEdits[card.id] ?? ""}
                          onChange={(event) => setCardEdits((prev) => ({ ...prev, [card.id]: event.target.value }))}
                          placeholder="Edit values, comma-separated"
                          aria-label={`Edit ${card.label}`}
                          style={{ ...inputStyle, padding: 10, fontSize: 13 }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                {researchFindings?.confirmationStatus === "pending" ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <ArchitectButton accent={accent} disabled={busy} onClick={() => void confirmResearch(true)}>Accept findings</ArchitectButton>
                    <ArchitectButton variant="secondary" disabled={busy} onClick={() => void confirmResearch(false)}>Reject</ArchitectButton>
                  </div>
                ) : null}
              </section>

              <section>
                <h3 style={{ marginTop: 0 }}>Upload evidence</h3>
                <p style={{ color: architect.inkMuted, marginTop: 0 }}>
                  PDF, DOCX, TXT, CSV, Excel, policies, CRM exports, SOPs, handbooks. Nothing mutates until confirmed.
                </p>
                <label
                  onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  style={{
                    ...dropZone,
                    borderColor: dragOver ? accent : architect.border,
                    background: dragOver ? architect.accentSoft : "rgba(15,23,42,.4)",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Drag & drop files here</div>
                  <div style={{ color: architect.inkMuted, fontSize: 13 }}>or click to choose</div>
                  <input type="file" multiple hidden onChange={(event) => void onUpload(event.target.files)} />
                </label>
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {uploads.map((upload) => {
                    const hint = detectUploadHint(upload.filename, upload.classification);
                    return (
                      <div key={upload.artifactId} style={findingCard}>
                        <div style={{ fontWeight: 700 }}>{upload.filename}</div>
                        <div style={{ color: architect.inkMuted, fontSize: 13, marginTop: 6 }}>
                          Detected: {hint.label} · Planned use: {hint.plannedUse}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <ArchitectBadge tone="accent">
                            Confidence: {humanizeToken(upload.confidence ?? "medium")}
                          </ArchitectBadge>
                          {" "}
                          <ArchitectBadge tone="success">Non-mutating until confirmed</ArchitectBadge>
                        </div>
                      </div>
                    );
                  })}
                  {!uploads.length ? (
                    <div style={{ color: architect.inkMuted, fontSize: 14 }}>No files yet — optional, but helpful.</div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          {centerMode === "proposal" ? (
            <div style={{ display: "grid", gap: 14 }}>
              {!proposal ? (
                <div style={{ color: architect.inkMuted }}>
                  Answer a few questions, optionally research or upload, then propose your Business OS.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ARCHITECT_PROPOSAL_SECTIONS.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        style={{
                          borderRadius: 999,
                          border: `1px solid ${architect.border}`,
                          padding: "7px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                          background: activeSection === section.id ? accent : "transparent",
                          color: activeSection === section.id ? "#042F2E" : architect.ink,
                          fontWeight: 650,
                        }}
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                  <h3 style={{ margin: 0 }}>{activeView?.title ?? ARCHITECT_PROPOSAL_SECTIONS.find((s) => s.id === activeSection)?.label}</h3>
                  {activeView?.headline ? <p style={{ color: architect.inkMuted, margin: 0 }}>{activeView.headline}</p> : null}
                  <div style={{ display: "grid", gap: 10 }}>
                    {(activeView?.items ?? activeView?.cards ?? activeView?.bullets ?? []).map((item: any, index: number) => (
                      <ProposalCard
                        key={item.id ?? item.label ?? index}
                        item={item}
                        canRename={activeSection === "navigation"}
                        onRename={renameModule}
                      />
                    ))}
                    {!((activeView?.items ?? activeView?.cards ?? activeView?.bullets ?? []).length) ? (
                      <div style={{ color: architect.inkMuted }}>No details in this section yet.</div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {centerMode === "portal" ? (
            <PortalPreview
              preview={portalPreview}
              previewRole={previewRole}
              accent={accent}
              onRole={(role) => {
                setPreviewRole(role);
                void loadPortal(role);
              }}
            />
          ) : null}
        </ArchitectPanel>

        {/* Right rail */}
        <ArchitectPanel style={{ minHeight: 720, display: "grid", alignContent: "start", gap: 14 }}>
          <h3 style={{ margin: 0 }}>Progress</h3>
          <p style={{ margin: 0, color: architect.inkMuted }}>{progress.label}</p>
          <div style={progressTrack}>
            <div style={{ ...progressFill, width: `${progress.percent}%`, background: accent }} />
          </div>

          <h4 style={{ margin: "8px 0 0" }}>Next</h4>
          <p style={{ margin: 0, color: architect.inkMuted }}>
            {proposal?.nextAction ?? nextQuestion?.prompt ?? "Tell us about your business."}
          </p>

          <h4 style={{ margin: "8px 0 0" }}>Still open</h4>
          <ul style={listStyle}>
            {(proposal?.unresolvedQuestions ?? session?.unresolvedQuestions ?? []).length
              ? (proposal?.unresolvedQuestions ?? session?.unresolvedQuestions ?? []).slice(0, 6).map((id: string) => (
                <li key={id}>{humanizeToken(String(id).replace(/^q_/, ""))}</li>
              ))
              : <li>None right now</li>}
          </ul>

          {error ? <div style={{ color: architect.danger }} role="alert">{error}</div> : null}

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <ArchitectButton
              accent={accent}
              disabled={!proposal || busy}
              onClick={() => router.push(routes.dryRun)}
            >
              Continue to dry run
            </ArchitectButton>
            <ArchitectButton variant="secondary" onClick={() => router.push(routes.home)}>
              Architect home
            </ArchitectButton>
          </div>
        </ArchitectPanel>
      </div>
    </ArchitectShell>
  );
}

function ProposalCard({
  item,
  canRename,
  onRename,
}: {
  item: any;
  canRename?: boolean;
  onRename?: (moduleId: string, label: string) => void;
}) {
  const label = item.label ?? item.title ?? item;
  return (
    <div style={findingCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>{label}</div>
        {item.status ? <ArchitectBadge>{humanizeToken(item.status)}</ArchitectBadge> : null}
        {item.kind ? <ArchitectBadge tone="accent">{humanizeToken(item.kind)}</ArchitectBadge> : null}
      </div>
      {item.purpose ? <div style={muted}>{item.purpose}</div> : null}
      {item.emptyState ? <div style={muted}>{item.emptyState}</div> : null}
      {Array.isArray(item.responsibilities) && item.responsibilities.length ? (
        <div style={muted}>Responsibilities: {item.responsibilities.join(" · ")}</div>
      ) : null}
      {item.approvalRequired || (Array.isArray(item.approvals) && item.approvals.length) ? (
        <div style={{ marginTop: 8 }}><ArchitectBadge tone="warning">Requires approval</ArchitectBadge></div>
      ) : null}
      {Array.isArray(item.modules) ? <div style={muted}>Sees: {item.modules.join(", ") || "—"}</div> : null}
      {canRename && onRename && item.id ? (
        <ArchitectButton
          variant="ghost"
          onClick={() => {
            const next = window.prompt("Rename this workspace", String(label));
            if (next?.trim()) onRename(String(item.id), next.trim());
          }}
        >
          Rename
        </ArchitectButton>
      ) : null}
    </div>
  );
}

function PortalPreview({
  preview,
  previewRole,
  accent,
  onRole,
}: {
  preview: any;
  previewRole: string;
  accent: string;
  onRole: (role: PreviewRole) => void;
}) {
  if (!preview?.ok) {
    return <div style={{ color: architect.inkMuted }}>Generate a proposal first, then preview the portal.</div>;
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ARCHITECT_PREVIEW_ROLES.map((role) => (
          <ArchitectButton
            key={role.id}
            variant={previewRole === role.id ? "primary" : "secondary"}
            accent={accent}
            onClick={() => onRole(role.id)}
          >
            {role.label}
          </ArchitectButton>
        ))}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: 0,
        minHeight: 440,
        borderRadius: architect.radius,
        overflow: "hidden",
        border: `1px solid ${architect.border}`,
      }}>
        <div style={{ background: "#070b14", padding: 16, color: architect.ink }}>
          <div style={{ fontWeight: 750, marginBottom: 14, color: accent }}>{preview.appearance?.businessName}</div>
          {(preview.sidebar?.primary ?? []).map((item: any) => (
            <div key={item.moduleId} style={{ padding: "10px 0", borderBottom: `1px solid ${architect.border}` }}>
              {item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: 16, background: "rgba(15,23,42,.55)", display: "grid", gap: 12, alignContent: "start" }}>
          <div style={{ fontWeight: 700 }}>{preview.roleLabel} dashboard</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {(preview.dashboard?.cards ?? []).map((card: any) => (
              <div key={card.id} style={findingCard}>
                <div style={{ fontWeight: 650 }}>{card.title}</div>
                <div style={muted}>{card.emptyState ?? "Empty until real data exists."}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 650, marginBottom: 8 }}>Workforce</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(preview.digitalWorkforce ?? []).slice(0, 4).map((employee: any) => (
                <div key={employee.name} style={findingCard}>
                  <strong>{employee.name}</strong>
                  <div style={muted}>{employee.purpose}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const progressTrack: CSSProperties = {
  height: 8,
  borderRadius: 999,
  background: "rgba(148,163,184,.18)",
  overflow: "hidden",
  marginTop: 8,
};

const progressFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width .35s ease",
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  background: "rgba(2,6,23,.45)",
  color: architect.ink,
  padding: 14,
  fontSize: 15,
  fontFamily: architect.font,
  resize: "vertical",
};

const findingCard: CSSProperties = {
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  background: "rgba(15,23,42,.55)",
  padding: 14,
};

const answerChip: CSSProperties = {
  ...findingCard,
  textAlign: "left",
  cursor: "pointer",
  color: architect.ink,
  width: "100%",
};

const dropZone: CSSProperties = {
  display: "block",
  borderRadius: architect.radius,
  border: `2px dashed ${architect.border}`,
  padding: 28,
  textAlign: "center",
  cursor: "pointer",
  transition: "border-color .15s ease, background .15s ease",
};

const muted: CSSProperties = {
  color: architect.inkMuted,
  fontSize: 13,
  marginTop: 6,
  lineHeight: 1.45,
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: architect.inkMuted,
};
