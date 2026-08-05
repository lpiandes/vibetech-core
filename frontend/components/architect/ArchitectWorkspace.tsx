"use client";

import { useCallback, useEffect, useState } from "react";
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
  architectRoutes,
} from "./architectSemantics";
import ConversationRail from "./ConversationRail";
import ActionDraftCard, { type ActionDraft } from "./ActionDraftCard";
import DiscoveryStepWizard from "./DiscoveryStepWizard";
import ResponsibilityReviewPanel from "./ResponsibilityReviewPanel";
import OsAssemblyCanvas from "./OsAssemblyCanvas";
import ProposalStudio from "./ProposalStudio";
import ApproveWalkthrough from "./ApproveWalkthrough";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";
import { parseOwnerPlanAdditions } from "./parseOwnerPlanAdditions";
import { composePurchasedPackagesPanel } from "@/components/operating/purchasedPackagesSemantics";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { isContinuousImproveSession } from "./askSessionResume";

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
  packageAsk = false,
  onSessionMutated,
  onStartOver,
  onPackageAskComplete,
}: {
  sessionId: string;
  continuous?: boolean;
  businessId?: string | null;
  /** When true, skip outer ArchitectShell (parent provides chrome, e.g. Ask history layout). */
  embedded?: boolean;
  /** Admin added packages — discovery only, then return Home (no full reinstall). */
  packageAsk?: boolean;
  onSessionMutated?: (session: any) => void;
  onStartOver?: () => void;
  onPackageAskComplete?: () => void;
}) {
  const router = useRouter();
  const scope = useOptionalBusinessScope();
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
  const [bootLoading, setBootLoading] = useState(true);
  const [accentColor, setAccentColor] = useState<string>(architect.accent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ProductErrorView | null>(null);
  /** Soft notice for optional research — never blocks discovery. */
  const [researchNotice, setResearchNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [askQuotaRemaining, setAskQuotaRemaining] = useState<number | null>(null);
  const [pendingActionDraft, setPendingActionDraft] = useState<ActionDraft | null>(null);

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
    if (data.quota && typeof data.quota.remaining === "number") {
      setAskQuotaRemaining(data.quota.remaining);
    }
    if (data.actionDraft) {
      setPendingActionDraft(data.actionDraft as ActionDraft);
    } else if (action === "chat") {
      setPendingActionDraft(null);
    }
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setBootLoading(true);
        const data = await refresh();
        if (cancelled) return;
        const treatAsContinuous = continuous || isContinuousImproveSession(data.session);
        // Ask is a chatbot first. Continuous improve never dumps into the plan studio.
        if (treatAsContinuous) {
          setCenterMode("conversation");
        } else if (packageAsk && data.journey?.readyForProposal) {
          // Everything for the new packages is already known / connected — go Home.
          try {
            await fetch(`/api/businesses/${encodeURIComponent(String(businessId))}/builder/package-ask`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "clear" }),
            });
          } catch {
            /* still send them home */
          }
          if (!cancelled) onPackageAskComplete?.();
          return;
        } else if (data.proposal) {
          setCenterMode("proposal");
        } else if (data.journey?.readyForProposal) {
          setCenterMode("recommendation");
        } else {
          setCenterMode("conversation");
        }
      } catch (err) {
        if (!cancelled) setError((err as any)?.productError ?? presentProductError(err));
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally only re-load when the session changes — unstable parent
    // callbacks must not re-trigger getWorkspace (that loop hammered the API).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- packageAsk/businessId stable for a given mount
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
  const allPackageIds = (
    Array.isArray(scope?.purchasedPackages) && scope.purchasedPackages.length
      ? scope.purchasedPackages
      : session?.businessSummary?.purchasedPackages
  ) ?? [];
  const addedPackageIds = packageAsk
    ? (
      scope?.pendingPackageAsk?.packages
      ?? session?.businessSummary?.packageAskPackages
      ?? session?.metadata?.packageAskPackages
      ?? []
    )
    : [];
  const purchasedPackagesPanel = composePurchasedPackagesPanel(allPackageIds, {
    packageAsk,
    addedIds: addedPackageIds,
  });
  // Only show the "what you bought" panel during discovery, before a proposal exists.
  const showPurchasedPackages = !continuous
    && !proposal
    && centerMode === "conversation"
    && purchasedPackagesPanel.show
    && !purchasedPackagesPanel.fullOs;
  // Package-Ask: only count answers given in this interview. Prior/installed/
  // already-connected seeds must not push the visible question to "Question 2".
  const discoveryAnswers = packageAsk
    ? (session?.answers ?? []).filter((row: { evidenceSource?: string }) => {
      const source = String(row?.evidenceSource ?? "");
      return source !== "installed_business"
        && source !== "prior_discovery"
        && source !== "already_connected";
    })
    : (session?.answers ?? []);

  const finishPackageAskIfReady = useCallback(async (ready: boolean) => {
    if (!packageAsk || !ready || !businessId) return;
    try {
      await fetch(`/api/businesses/${encodeURIComponent(businessId)}/builder/package-ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
    } catch {
      /* still send them home */
    }
    onPackageAskComplete?.();
  }, [packageAsk, businessId, onPackageAskComplete]);

  async function answerDiscovery({ questionId, answer }: { questionId: string; answer: string }) {
    setBusy(true);
    setThinking(true);
    setError(null);
    setResearchNotice(null);
    try {
      const answered = await refresh("answer", {
        questionId,
        answer,
        unknown: false,
        skipped: false,
      });
      const ready = Boolean(
        answered.journey?.readyForProposal
        ?? answered.progress?.readyForProposal,
      );
      const noMoreQuestions = !answered.nextQuestions?.length
        && !(answered.session?.questions?.length);
      if (ready || (packageAsk && noMoreQuestions)) {
        if (packageAsk) {
          await finishPackageAskIfReady(true);
          return;
        }
        if (!answered.proposal) {
          setCenterMode("recommendation");
          setQuickReplies(answered.quickReplies ?? []);
          try {
            await refresh("propose");
            setCenterMode("proposal");
            setChangeImpact(null);
          } catch (proposeErr) {
            setError((proposeErr as any)?.productError ?? presentProductError(proposeErr));
          }
        } else {
          setCenterMode("proposal");
        }
        return;
      }
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
      const treatAsContinuous = continuous || isContinuousImproveSession(session);
      if (treatAsContinuous) {
        await refresh("chat", { text: text || "I don't know" });
        setQuickReplies([]);
        setCenterMode("conversation");
        setMessage("");
        return;
      }
      if (!proposal) {
        await refresh("chat", { text: text || "I don't know" });
        setQuickReplies([]);
        const workspace = await refresh();
        if (workspace.journey?.readyForProposal) {
          if (packageAsk) {
            await finishPackageAskIfReady(true);
            return;
          }
          setCenterMode("recommendation");
          try {
            await refresh("propose");
            setCenterMode("proposal");
            setChangeImpact(null);
          } catch (proposeErr) {
            setError((proposeErr as any)?.productError ?? presentProductError(proposeErr));
          }
        }
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

  const chatFill = continuous && embedded && inConversation;

  const body = (
    <div
      style={chatFill ? {
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 120px)",
        height: "100%",
      } : undefined}
    >
      <header style={{
        marginBottom: continuous && embedded ? 8 : 20,
        textAlign: embedded ? "left" : "center",
        flex: "0 0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{
            margin: 0,
            fontFamily: architect.display,
            fontSize: continuous && embedded ? "clamp(1.15rem, 2.2vw, 1.4rem)" : "clamp(1.5rem, 3vw, 1.9rem)",
            letterSpacing: "-0.02em",
            fontWeight: 650,
          }}>
            {continuous ? "Ask VIBETech" : packageAsk ? "Finish setup" : "Set up your business"}
          </h1>
          {continuous && embedded && askQuotaRemaining != null ? (
            <p style={{ margin: 0, fontSize: 12, color: architect.inkMuted, fontWeight: 650 }}>
              {askQuotaRemaining} of 5 AI asks left today
            </p>
          ) : null}
          {!continuous && onStartOver ? (
            <button
              type="button"
              onClick={onStartOver}
              style={{
                border: "none",
                background: "transparent",
                color: architect.inkMuted,
                fontSize: 13,
                fontWeight: 650,
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              Start over
            </button>
          ) : null}
        </div>
        {!chatFill && !packageAsk ? (
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
        ) : null}
      </header>

      {error ? (
        <div style={{ marginBottom: 16, flex: "0 0 auto" }}>
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
            flex: "0 0 auto",
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
              ? {
                  maxWidth: chatFill ? 760 : 640,
                  margin: 0,
                  width: "100%",
                  flex: chatFill ? "1 1 auto" : undefined,
                  minHeight: chatFill ? 0 : undefined,
                  display: chatFill ? "flex" : undefined,
                  flexDirection: chatFill ? "column" : undefined,
                }
              : { maxWidth: "100%", margin: 0 }
            : undefined
        }
      >
        {inConversation ? (
          <ArchitectPanel style={{
            display: chatFill ? "flex" : "grid",
            flexDirection: chatFill ? "column" : undefined,
            gap: 12,
            padding: continuous ? "14px 16px 16px" : "28px 24px",
            flex: chatFill ? "1 1 auto" : undefined,
            minHeight: chatFill ? 0 : undefined,
            height: chatFill ? "100%" : undefined,
          }}>
            {!continuous && showPurchasedPackages ? (
              <div style={{
                border: `1px solid ${architect.border}`,
                borderRadius: 12,
                background: "rgba(15,23,42,.45)",
                padding: "12px 14px",
                display: "grid",
                gap: 8,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: architect.inkMuted, letterSpacing: "0.02em" }}>
                  {purchasedPackagesPanel.heading}
                </div>
                <div style={{ display: "grid", gap: purchasedPackagesPanel.compact ? 4 : 6 }}>
                  {purchasedPackagesPanel.packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 650, fontSize: 14 }}>{pkg.label}</div>
                        {!purchasedPackagesPanel.compact && pkg.description ? (
                          <div style={{ color: architect.inkMuted, fontSize: 12, lineHeight: 1.45 }}>
                            {pkg.description}
                          </div>
                        ) : null}
                      </div>
                      {pkg.added ? (
                        <span style={{
                          flex: "0 0 auto",
                          fontSize: 11,
                          fontWeight: 700,
                          color: architect.accent,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}>
                          New
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
                {purchasedPackagesPanel.note ? (
                  <div style={{ color: architect.inkMuted, fontSize: 12, lineHeight: 1.45 }}>
                    {purchasedPackagesPanel.note}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!continuous ? (
              (Array.isArray(session?.responsibilityRequests) && session.responsibilityRequests.length > 0
                && !session?.responsibilityInventoryConfirmed) ? (
                <ResponsibilityReviewPanel
                  responsibilities={session.responsibilityRequests}
                  busy={busy}
                  onConfirm={async (items) => {
                    setBusy(true);
                    setThinking(true);
                    setError(null);
                    try {
                      await refresh("confirm_responsibilities", {
                        responsibilityRequests: items,
                        confirmed: true,
                      });
                    } catch (err) {
                      setError((err as any)?.productError ?? presentProductError(err));
                    } finally {
                      setBusy(false);
                      setThinking(false);
                    }
                  }}
                />
              ) : (
              <DiscoveryStepWizard
                answers={discoveryAnswers}
                nextQuestion={nextQuestion}
                busy={busy}
                thinking={thinking || bootLoading}
                thinkingLabel={bootLoading ? "Loading…" : "Saving your answer"}
                websiteUrl={websiteUrl}
                setWebsiteUrl={setWebsiteUrl}
                onResearch={() => void runResearch()}
                researchBusy={researchBusy}
                uploads={uploads}
                onUploadFiles={(files) => void onUpload(files)}
                dragOver={dragOver}
                setDragOver={setDragOver}
                onAnswer={answerDiscovery}
                packageAsk={packageAsk}
                persistKey={sessionId}
                onFinish={() => {
                  if (packageAsk) {
                    void finishPackageAskIfReady(true);
                    return;
                  }
                  setCenterMode("recommendation");
                }}
              />
              )
            ) : (
              <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
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
                  actionDraft={pendingActionDraft}
                  businessId={businessId ?? undefined}
                  onDismissActionDraft={() => setPendingActionDraft(null)}
                />
              </div>
            )}

            {!continuous && journey?.readyForProposal && !proposal ? (
              <div style={{
                borderTop: `1px solid ${architect.border}`,
                paddingTop: 16,
                display: "grid",
                gap: 10,
              }}>
                <p style={{ margin: 0, color: architect.inkMuted, fontSize: 14, lineHeight: 1.5 }}>
                  VIBETech has enough to show what will be built.
                </p>
                <ArchitectButton disabled={busy} onClick={() => void propose()}>
                  See what we’ll build
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
              onApprove={() => {
                // Skip dry-run maze — open install and go live, then hard-nav to Home.
                router.push(`${routes.install}?launch=1`);
              }}
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
              onConfirm={() => router.push(`${routes.install}?launch=1`)}
              onBackToRecommendation={() => setCenterMode("proposal")}
              onKeepTalking={continuous ? () => setCenterMode("conversation") : undefined}
            />
          </ArchitectPanel>
        ) : null}
      </div>
    </div>
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
