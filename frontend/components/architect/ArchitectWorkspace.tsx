"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { architect } from "./architectTheme";
import {
  ArchitectButton,
  ArchitectPanel,
  ArchitectShell,
  ArchitectSkeleton,
  ThinkingDots,
} from "./ArchitectPrimitives";
import {
  HUMAN_COPY,
  architectRoutes,
} from "./architectSemantics";
import ConversationRail from "./ConversationRail";
import DiscoveryStepWizard from "./DiscoveryStepWizard";
import OsAssemblyCanvas from "./OsAssemblyCanvas";
import ProposalStudio from "./ProposalStudio";
import ApproveWalkthrough from "./ApproveWalkthrough";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";
import { parseOwnerPlanAdditions } from "./parseOwnerPlanAdditions";

/** Shared mode model for initial + continuous — maps to constitution progress. */
type CenterMode = "conversation" | "recommendation" | "proposal" | "preview";

/**
 * One conversation at a time — Ask VIBETech.
 * Discovery: chat only. Recommendation/preview: replace the chat with that one surface.
 */
export default function ArchitectWorkspace({
  sessionId,
  continuous = false,
  businessId = null,
  embedded = false,
  onSessionMutated,
}: {
  sessionId: string;
  continuous?: boolean;
  businessId?: string | null;
  /** When true, skip outer ArchitectShell (parent provides chrome, e.g. Ask history layout). */
  embedded?: boolean;
  onSessionMutated?: (session: any) => void;
}) {
  const router = useRouter();
  const routes = architectRoutes(sessionId, businessId);
  const [session, setSession] = useState<any>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [journey, setJourney] = useState<any>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [researchFindings, setResearchFindings] = useState<any>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [changeImpact, setChangeImpact] = useState<any>(null);
  const [centerMode, setCenterMode] = useState<CenterMode>("conversation");
  const [message, setMessage] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [researchBusy, setResearchBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(architect.accent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ProductErrorView | null>(null);
  /** Soft notice for optional research — never blocks discovery. */
  const [researchNotice, setResearchNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
    if (data.session) {
      setSession(data.session);
      onSessionMutated?.(data.session);
    }
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
        // Ask is a chatbot first. Continuous improve never dumps into the plan studio.
        if (continuous) {
          setCenterMode("conversation");
        } else if (data.proposal) {
          setCenterMode("proposal");
        } else if (data.journey?.readyForProposal) {
          setCenterMode("recommendation");
        } else {
          setCenterMode("conversation");
        }
      } catch (err) {
        setError((err as any)?.productError ?? presentProductError(err));
      } finally {
        setThinking(false);
      }
    })();
  }, [sessionId, continuous]);

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
  const readyForProposal = Boolean(journey?.readyForProposal) || Boolean(proposal);

  async function answerDiscovery({ questionId, answer }: { questionId: string; answer: string }) {
    setBusy(true);
    setThinking(true);
    setError(null);
    setResearchNotice(null);
    try {
      await refresh("answer", {
        questionId,
        answer,
        unknown: false,
        skipped: false,
      });
      const workspace = await refresh();
      setQuickReplies(workspace.quickReplies ?? []);
      if (workspace.journey?.readyForProposal && !workspace.proposal) setCenterMode("recommendation");
      setMessage("");
      setWebsiteUrl("");
    } catch (err) {
      setError((err as any)?.productError ?? presentProductError(err));
    } finally {
      setBusy(false);
      setThinking(false);
    }
  }

  async function send(override?: string) {
    const text = (override ?? message).trim();
    setBusy(true);
    setThinking(true);
    setError(null);
    try {
      if (!proposal) {
        await refresh("chat", { text: text || "I don't know" });
        setQuickReplies([]);
        const workspace = await refresh();
        if (workspace.journey?.readyForProposal) setCenterMode("recommendation");
      } else {
        const data = await refresh("chat", { text });
        setChangeImpact(data.changeImpact ?? null);
        setQuickReplies([]);
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
    setCenterMode("recommendation");
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
    setResearchNotice(null);
    try {
      await refresh("research", { websiteUrl: websiteUrl || session?.websiteUrls?.[0] });
      await refresh();
      setResearchNotice(null);
    } catch (err) {
      // Website review is optional — soft-fail so discovery can continue without a blocking banner.
      const productError = (err as any)?.productError ?? presentProductError(err);
      const reason = String((err as any)?.message ?? productError?.whatHappened ?? "").toLowerCase();
      const soft =
        /research|fetch_failed|unavailable|timeout|could not reach|could not review/i.test(reason)
        || productError?.title === "Website review unavailable";
      if (soft) {
        setResearchNotice(
          "We couldn’t review that website right now. Your answer was saved — continue, or try another URL later.",
        );
      } else if (/invalid.?url/i.test(reason) || productError?.title?.includes("Website address")) {
        setResearchNotice(productError.message || "That website address needs a fix.");
      } else {
        setError(productError);
      }
    } finally {
      setResearchBusy(false);
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
          notes: "Uploaded while talking with VIBETech",
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

  function openReview() {
    setCenterMode("preview");
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
  }

  async function renameProposalItem(input: {
    sectionId: string;
    id: string;
    label?: string;
    purpose?: string;
  }) {
    if (input.sectionId === "navigation") {
      await renameModule(input.id, String(input.label ?? ""));
      return;
    }
    if (input.sectionId === "employees") {
      await refresh("update_appearance", {
        employeeOverrides: {
          labels: input.label ? { [input.id]: input.label } : {},
          purposes: input.purpose ? { [input.id]: input.purpose } : {},
        },
      });
      return;
    }
    if (input.sectionId === "roles") {
      await refresh("update_appearance", {
        roleOverrides: {
          labels: input.label ? { [input.id]: input.label } : {},
        },
      });
    }
  }

  async function applyPlanChanges(input: {
    removeModuleIds: string[];
    removeEmployeeIds: string[];
    addRequest: string;
  }) {
    setBusy(true);
    setThinking(true);
    setError(null);
    try {
      // Optimistic local merge so the teammate appears before the round-trip finishes.
      const parsed = parseOwnerPlanAdditions(input.addRequest);
      if (proposal && (parsed.employees.length || parsed.modules.length)) {
        setProposal(mergeParsedAdditionsIntoProposal(proposal, parsed, input));
      }

      // Server parses + persists — source of truth (survives stale client parsers / HMR).
      const data = await refresh("apply_plan_changes", {
        removeModuleIds: input.removeModuleIds,
        removeEmployeeIds: input.removeEmployeeIds,
        addRequest: input.addRequest,
      });
      if (data?.proposal) setProposal(data.proposal);
    } catch (err) {
      setError((err as any)?.productError ?? presentProductError(err));
      // Re-sync on failure so optimistic junk does not stick.
      try {
        const workspace = await refresh();
        if (workspace?.proposal) setProposal(workspace.proposal);
      } catch {
        // ignore secondary refresh failure
      }
      throw err;
    } finally {
      setBusy(false);
      setThinking(false);
    }
  }

  if (!session && !error) {
    const loading = (
      <ArchitectPanel style={{ display: "grid", gap: 14 }}>
        <ThinkingDots label="Opening Ask VIBETech" />
        <ArchitectSkeleton height={28} width="40%" />
        <ArchitectSkeleton height={220} />
      </ArchitectPanel>
    );
    return embedded ? loading : <ArchitectShell maxWidth={720}>{loading}</ArchitectShell>;
  }

  const showingProposal = centerMode === "proposal" && Boolean(proposal);
  const showingPreview = centerMode === "preview";
  const showingRecommendationPrep = centerMode === "recommendation" && !proposal;
  const inConversation = !showingProposal && !showingPreview && !showingRecommendationPrep;

  const body = (
    <>
      <header style={{ marginBottom: continuous && embedded ? 12 : 20, textAlign: embedded ? "left" : "center" }}>
        <h1 style={{
          margin: 0,
          fontFamily: architect.display,
          fontSize: continuous && embedded ? "clamp(1.25rem, 2.4vw, 1.55rem)" : "clamp(1.5rem, 3vw, 1.9rem)",
          letterSpacing: "-0.02em",
          fontWeight: 650,
        }}>
          Ask VIBETech
        </h1>
        <p style={{ margin: continuous && embedded ? "4px 0 0" : "8px 0 0", color: architect.inkMuted, fontSize: continuous && embedded ? 13 : 15, lineHeight: 1.5 }}>
          {showingProposal
            ? "Here is how VIBETech recommends running your business."
            : showingPreview
              ? continuous
                ? "One step at a time — review this change before it applies."
                : "One step at a time — review what you’re approving."
              : continuous
                ? "Ask anything about this business. Nothing changes until you approve."
                : "One question at a time. Type an answer, then Next."}
        </p>
      </header>

      {error ? (
        <div style={{ marginBottom: 16 }}>
          <ProductErrorBanner error={error} />
        </div>
      ) : null}

      {researchNotice && !error ? (
        <div
          role="status"
          style={{
            marginBottom: 16,
            borderRadius: 12,
            border: `1px solid ${architect.border}`,
            background: "rgba(15,23,42,.55)",
            padding: "12px 14px",
            color: architect.inkMuted,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {researchNotice}
        </div>
      ) : null}

      <div
        className="architect-workspace-grid"
        style={
          embedded
            ? continuous
              ? { maxWidth: 640, margin: 0 }
              : { maxWidth: "100%", margin: 0 }
            : undefined
        }
      >
        {inConversation ? (
          <ArchitectPanel style={{ display: "grid", gap: 12, padding: continuous ? "18px 18px" : "28px 24px" }}>
            {!continuous ? (
              <DiscoveryStepWizard
                answers={session?.answers ?? []}
                nextQuestion={nextQuestion}
                busy={busy}
                thinking={thinking}
                websiteUrl={websiteUrl}
                setWebsiteUrl={setWebsiteUrl}
                onResearch={() => void runResearch()}
                researchBusy={researchBusy}
                uploads={uploads}
                onUploadFiles={(files) => void onUpload(files)}
                dragOver={dragOver}
                setDragOver={setDragOver}
                onAnswer={answerDiscovery}
                minRequiredAnswers={Number(journey?.minRequiredAnswers ?? session?.progress?.minRequiredAnswers ?? 16)}
                requiredTotal={Number(session?.progress?.requiredTotal ?? journey?.requiredTotal ?? 18)}
                answeredCount={Number(session?.progress?.requiredAnswered ?? session?.answers?.length ?? 0)}
                onFinish={() => setCenterMode("recommendation")}
              />
            ) : (
              <ConversationRail
                conversation={conversation}
                nextQuestion={nextQuestion}
                quickReplies={quickReplies}
                message={message}
                setMessage={setMessage}
                thinking={thinking}
                busy={busy}
                mode="chat"
                onSubmit={() => void send()}
                onQuickReply={(value) => void send(value)}
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
              />
            )}

            {!continuous && journey?.readyForProposal && !proposal ? (
              <div style={{
                borderTop: `1px solid ${architect.border}`,
                paddingTop: 16,
                display: "grid",
                gap: 10,
              }}>
                <p style={{ margin: 0, color: architect.inkMuted, fontSize: 14, lineHeight: 1.5 }}>
                  VIBETech has enough to recommend how your business should run.
                </p>
                <ArchitectButton disabled={busy} onClick={() => setCenterMode("recommendation")}>
                  Continue
                </ArchitectButton>
              </div>
            ) : null}

            {continuous && journey?.readyForProposal && !proposal ? (
              <div style={{
                borderTop: `1px solid ${architect.border}`,
                paddingTop: 16,
                display: "grid",
                gap: 10,
              }}>
                <p style={{ margin: 0, color: architect.inkMuted, fontSize: 14, lineHeight: 1.5 }}>
                  VIBETech has enough to recommend how your business should run.
                </p>
                <ArchitectButton disabled={busy} onClick={() => void propose()}>
                  {busy ? HUMAN_COPY.rethink : HUMAN_COPY.proposePlan}
                </ArchitectButton>
              </div>
            ) : null}

            {continuous && proposal ? (
              <div style={{
                borderTop: `1px solid ${architect.border}`,
                paddingTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}>
                <p style={{ margin: 0, color: architect.inkMuted, fontSize: 13, lineHeight: 1.45, flex: "1 1 220px" }}>
                  A recommendation is ready when you want to review it.
                </p>
                <ArchitectButton variant="secondary" disabled={busy} onClick={() => setCenterMode("proposal")}>
                  Review recommendation
                </ArchitectButton>
              </div>
            ) : null}
          </ArchitectPanel>
        ) : null}

        {showingRecommendationPrep ? (
          <ArchitectPanel style={{ display: "grid", gap: 16, padding: "24px 22px" }}>
            <OsAssemblyCanvas
              proposal={proposal}
              readyForProposal={readyForProposal}
              busy={busy}
              onPropose={() => void propose()}
              onOpenProposal={() => setCenterMode("proposal")}
            />
            <ArchitectButton variant="ghost" onClick={() => setCenterMode("conversation")}>
              {continuous ? "Back to conversation" : "Back"}
            </ArchitectButton>
          </ArchitectPanel>
        ) : null}

        {showingProposal ? (
          <ArchitectPanel style={{ display: "grid", gap: 16, padding: "24px 22px" }}>
            <ProposalStudio
              proposal={proposal}
              continuous={continuous}
              onApprove={() => router.push(routes.dryRun)}
              onRequestChanges={(input) => applyPlanChanges(input)}
              onBack={() => setCenterMode(continuous ? "conversation" : "recommendation")}
              busy={busy}
            />
          </ArchitectPanel>
        ) : null}

        {showingPreview ? (
          <ArchitectPanel style={{ display: "grid", gap: 16, padding: "24px 22px" }}>
            <ApproveWalkthrough
              proposal={proposal}
              continuous={continuous}
              busy={busy}
              onConfirm={() => router.push(routes.dryRun)}
              onBackToRecommendation={() => setCenterMode("proposal")}
              onKeepTalking={continuous ? () => setCenterMode("conversation") : undefined}
            />
          </ArchitectPanel>
        ) : null}
      </div>
    </>
  );

  return embedded ? body : <ArchitectShell maxWidth={760}>{body}</ArchitectShell>;
}

/** Optimistic UI merge so owner additions show before the server round-trip. */
function mergeParsedAdditionsIntoProposal(
  proposal: any,
  parsed: { modules: Array<{ id: string; label: string; purpose?: string; ownerAdded?: boolean }>; employees: Array<{ id: string; label: string; purpose?: string; ownerAdded?: boolean }> },
  input: { removeModuleIds: string[]; removeEmployeeIds: string[] },
) {
  const navItems = [...(proposal?.views?.navigation?.items ?? [])]
    .filter((item: any) => !input.removeModuleIds.includes(String(item.id)));
  const workforceItems = [...(proposal?.views?.digitalWorkforce?.items ?? [])]
    .filter((item: any) => !input.removeEmployeeIds.includes(String(item.id)));

  for (const mod of parsed.modules) {
    if (navItems.some((item: any) => String(item.id) === String(mod.id))) continue;
    navItems.push({ id: mod.id, label: mod.label, ownerAdded: true });
  }
  for (const emp of parsed.employees) {
    if (workforceItems.some((item: any) => String(item.id) === String(emp.id))) continue;
    workforceItems.push({
      id: emp.id,
      label: emp.label,
      purpose: emp.purpose,
      ownerAdded: true,
    });
  }

  return {
    ...proposal,
    views: {
      ...proposal.views,
      navigation: {
        ...(proposal.views?.navigation ?? {}),
        items: navItems,
      },
      digitalWorkforce: {
        ...(proposal.views?.digitalWorkforce ?? {}),
        items: workforceItems,
      },
    },
  };
}
