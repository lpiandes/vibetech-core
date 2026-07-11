"use client";

import { useEffect, useState } from "react";
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
  HUMAN_COPY,
  architectRoutes,
  confidenceLabel,
} from "./architectSemantics";
import ConversationRail from "./ConversationRail";
import BusinessUnderstandingPanel from "./BusinessUnderstandingPanel";
import BusinessDnaPortrait from "./BusinessDnaPortrait";
import ReasoningStrip from "./ReasoningStrip";
import OsAssemblyCanvas from "./OsAssemblyCanvas";
import ProposalStudio from "./ProposalStudio";
import PortalPreviewImmersive from "./PortalPreviewImmersive";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";

type PreviewRole = "OWNER" | "MANAGER" | "EMPLOYEE";
type CenterMode = "discovery" | "assembly" | "proposal" | "portal";

/**
 * Consultant shell — conversation left, stage canvas center, understanding right.
 * Reuses /api/builder/sessions actions only.
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
  const [centerMode, setCenterMode] = useState<CenterMode>("discovery");
  const [message, setMessage] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [researchBusy, setResearchBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string>(architect.accent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ProductErrorView | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  async function refresh(action?: string, body: Record<string, unknown> = {}) {
    const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
      method: action ? "POST" : "GET",
      headers: action ? { "content-type": "application/json" } : undefined,
      body: action ? JSON.stringify({ action, ...body }) : undefined,
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw Object.assign(new Error(data.error ?? data.reason ?? data.message ?? "Something went wrong."), {
        productError: data.productError ?? presentProductError(data.error ?? data.reason ?? data.message),
      });
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
        else if (data.journey?.readyForProposal) setCenterMode("assembly");
      } catch (err) {
        setError((err as any)?.productError ?? presentProductError(err));
      } finally {
        setThinking(false);
      }
    })();
  }, [sessionId]);

  const accent = proposal?.accentColor ?? accentColor;
  const conversation = session?.conversation ?? [];
  const nextQuestionRaw = session?.questions?.[0] ?? null;
  const nextQuestion = nextQuestionRaw
    ? {
        ...nextQuestionRaw,
        text: nextQuestionRaw.text ?? nextQuestionRaw.prompt,
        why: nextQuestionRaw.why,
      }
    : null;
  const confidence = confidenceLabel(
    proposal?.confidence ?? session?.progress?.confidence ?? researchFindings?.confidence ?? "medium",
  );
  const readyForProposal = Boolean(journey?.readyForProposal) || Boolean(proposal);

  async function send(override?: string, opts: { unknown?: boolean; skipped?: boolean } = {}) {
    const text = (override ?? message).trim();
    setBusy(true);
    setThinking(true);
    setError(null);
    try {
      const questionId = editingAnswerId ?? nextQuestionRaw?.questionId;
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
        if (workspace.journey?.readyForProposal && !workspace.proposal) setCenterMode("assembly");
      } else {
        const data = await refresh("chat", { text });
        setChangeImpact(data.changeImpact ?? null);
      }
      setMessage("");
    } catch (err) {
      setError((err as any)?.productError ?? presentProductError(err));
    } finally {
      setBusy(false);
      setThinking(false);
    }
  }

  async function propose() {
    setBusy(true);
    setThinking(true);
    setError(null);
    setCenterMode("assembly");
    try {
      await refresh("propose");
      setCenterMode("proposal");
      setChangeImpact(null);
    } catch (err) {
      setError((err as any)?.productError ?? presentProductError(err));
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
      setError((err as any)?.productError ?? presentProductError(err));
    } finally {
      setResearchBusy(false);
      setThinking(false);
    }
  }

  async function confirmResearch(accepted: boolean) {
    setBusy(true);
    try {
      await refresh("confirm_research", { accepted, edits: {} });
      await refresh();
    } catch (err) {
      setError((err as any)?.productError ?? presentProductError(err));
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
        let contentBase64: string | null = null;
        if (file.size > 0 && file.size <= 2_000_000) {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
          contentBase64 = btoa(binary);
        }
        await refresh("upload", {
          filename: file.name,
          mimeType: file.type,
          textPreview,
          contentBase64,
          notes: "Uploaded during Architect discovery",
        });
      }
      await refresh();
    } catch (err) {
      setError((err as any)?.productError ?? presentProductError(err));
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
      setPreviewRole(role);
      setCenterMode("portal");
    } catch (err) {
      setError((err as any)?.productError ?? presentProductError(err));
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
    <ArchitectShell maxWidth={1480}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <ArchitectBadge tone="accent">Ask VIBETech · Architect</ArchitectBadge>
          <h1 style={{
            margin: "10px 0 6px",
            fontFamily: architect.display,
            fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
            letterSpacing: "-0.02em",
          }}>
            {proposal?.businessName ?? session?.businessSummary?.businessName ?? "Understanding your business"}
          </h1>
          <p style={{ margin: 0, color: architect.inkMuted }}>
            One thoughtful conversation. Nothing goes live until you approve.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <ArchitectBadge tone={confidence.tone}>{confidence.label}</ArchitectBadge>
          {(["discovery", "assembly", "proposal", "portal"] as CenterMode[]).map((mode) => {
            const disabled = (mode === "proposal" || mode === "portal") && !proposal;
            const label =
              mode === "discovery" ? "Conversation"
                : mode === "assembly" ? "Assembly"
                  : mode === "proposal" ? "Plan"
                    : "Preview";
            return (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (mode === "portal" && proposal) void loadPortal(previewRole);
                  else setCenterMode(mode);
                }}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${centerMode === mode ? architect.accent : architect.border}`,
                  background: centerMode === mode ? architect.accentSoft : "transparent",
                  color: architect.ink,
                  padding: "7px 12px",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.45 : 1,
                  fontSize: 13,
                  fontWeight: centerMode === mode ? 700 : 500,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </header>

      {error ? (
        <div style={{ marginBottom: 16 }}>
          <ProductErrorBanner error={error} />
        </div>
      ) : null}

      <div className="architect-workspace-grid">
        <ArchitectPanel style={{ display: "grid", gap: 14, alignContent: "start", minHeight: 680 }}>
          <ConversationRail
            conversation={conversation}
            nextQuestion={nextQuestion}
            quickReplies={quickReplies}
            message={message}
            setMessage={setMessage}
            thinking={thinking}
            busy={busy}
            mode={proposal ? "chat" : "discovery"}
            onSubmit={() => void send()}
            onQuickReply={(value) => void send(value, {
              unknown: /don.?t know|not sure/i.test(value),
              skipped: /skip/i.test(value),
            })}
            onSkip={() => void send("Skipped for now", { skipped: true })}
            onUnknown={() => void send("I'm not sure", { unknown: true })}
            websiteUrl={websiteUrl}
            setWebsiteUrl={setWebsiteUrl}
            onResearch={() => void runResearch()}
            researchBusy={researchBusy}
            researchFindings={researchFindings}
            onConfirmResearch={(accepted) => void confirmResearch(accepted)}
            uploads={uploads}
            onUploadFiles={(files) => void onUpload(files)}
            dragOver={dragOver}
            setDragOver={setDragOver}
            showEvidence={showEvidence}
            setShowEvidence={setShowEvidence}
          />
        </ArchitectPanel>

        <ArchitectPanel style={{ display: "grid", gap: 16, alignContent: "start", minHeight: 680 }}>
          {centerMode === "discovery" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <ArchitectBadge tone="accent">Discovery</ArchitectBadge>
                <h2 style={{ margin: "10px 0 6px", fontFamily: architect.display, fontSize: 28 }}>
                  Listening first
                </h2>
                <p style={{ margin: 0, color: architect.inkMuted, lineHeight: 1.55 }}>
                  Architect builds understanding as you talk. When enough is clear, you can ask for the plan.
                </p>
              </div>
              {readyForProposal ? (
                <OsAssemblyCanvas
                  proposal={proposal}
                  readyForProposal={readyForProposal}
                  busy={busy}
                  onPropose={() => void propose()}
                  onOpenProposal={() => setCenterMode("proposal")}
                />
              ) : (
                <div style={{
                  borderRadius: architect.radius,
                  border: `1px solid ${architect.border}`,
                  background: "rgba(15,23,42,.4)",
                  padding: 24,
                  color: architect.inkMuted,
                  lineHeight: 1.55,
                }}>
                  Keep answering in plain language. Share a website or documents anytime from the conversation.
                </div>
              )}
              {journey?.readyForProposal && !proposal ? (
                <ArchitectButton disabled={busy} onClick={() => void propose()}>
                  {busy ? HUMAN_COPY.rethink : HUMAN_COPY.proposePlan}
                </ArchitectButton>
              ) : null}
            </div>
          ) : null}

          {centerMode === "assembly" ? (
            <OsAssemblyCanvas
              proposal={proposal}
              readyForProposal={readyForProposal}
              busy={busy}
              onPropose={() => void propose()}
              onOpenProposal={() => setCenterMode("proposal")}
            />
          ) : null}

          {centerMode === "proposal" && proposal ? (
            <ProposalStudio
              proposal={proposal}
              accentColor={accent}
              onAccent={(color) => void saveAccent(color)}
              onRenameNav={(moduleId, label) => void renameModule(moduleId, label)}
              onPreview={() => void loadPortal(previewRole)}
              onPrepareLaunch={() => router.push(routes.dryRun)}
              busy={busy}
            />
          ) : null}

          {centerMode === "portal" ? (
            <PortalPreviewImmersive
              portalPreview={portalPreview}
              proposal={proposal}
              previewRole={previewRole}
              onRoleChange={(role) => void loadPortal(role)}
              accentColor={accent}
              busy={busy}
            />
          ) : null}
        </ArchitectPanel>

        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <ArchitectPanel>
            <BusinessUnderstandingPanel
              summary={session?.businessSummary}
              session={session}
              journey={journey}
            />
          </ArchitectPanel>
          <ArchitectPanel>
            <BusinessDnaPortrait summary={session?.businessSummary} />
          </ArchitectPanel>
          <ArchitectPanel>
            <ReasoningStrip
              nextQuestion={nextQuestion}
              proposal={proposal}
              assumptions={proposal?.assumptions ?? session?.assumptions}
              recommendations={proposal?.recommendations ?? session?.recommendations}
              changeImpact={changeImpact}
            />
          </ArchitectPanel>
        </div>
      </div>
    </ArchitectShell>
  );
}
