"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ArchitectWorkspace from "./ArchitectWorkspace";
import AskVibeTechPrompt from "@/components/operating/AskVibeTechPrompt";
import AskHistorySidebar from "./AskHistorySidebar";
import {
  ArchitectPanel,
  ArchitectShell,
  ArchitectSkeleton,
  ThinkingDots,
} from "./ArchitectPrimitives";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";
import { architect } from "./architectTheme";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import {
  isContinuousImproveSession,
  pickResumableSessionId,
  presentAskHistory,
  type AskHistoryItem,
} from "./askSessionResume";
import { ASK_NEW_CHAT_EVENT } from "./askOpenChat";

const CONTEXT_KEYS = [
  "intelligenceCandidateId",
  "workId",
  "personId",
  "partyId",
  "subjectId",
  "integrationId",
  "proposalId",
  "employeeId",
] as const;

/**
 * Permanent Ask VIBETech surface under /b/[businessId]/architect.
 *
 * Pre-install → discovery conversation (may resume).
 * Post-install → new chat on entry + left-rail history to reopen past ones.
 */
export default function InBusinessArchitect({ businessId }: { businessId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = useBusinessScope();
  const hasInstalledOs = Boolean(scope.installedBusinessOS?.drivenByBusinessOS);
  const sessionFromQuery = searchParams.get("sessionId");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<AskHistoryItem[]>([]);
  const [error, setError] = useState<ProductErrorView | null>(null);
  const [booting, setBooting] = useState(true);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [bootKey, setBootKey] = useState(0);

  const refreshHistory = useCallback(async (activeId: string | null = null) => {
    try {
      const response = await fetch(`/api/builder/sessions?businessId=${encodeURIComponent(businessId)}`);
      const data = await response.json();
      const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
      setHistory(presentAskHistory(sessions, { activeSessionId: activeId }));
    } catch {
      /* history is optional chrome */
    }
  }, [businessId]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setBooting(true);
      setError(null);

      const promptFromQuery = searchParams.get("prompt");
      const context: Record<string, string> = {};
      for (const key of CONTEXT_KEYS) {
        const value = searchParams.get(key);
        if (value) context[key] = value;
      }
      const hasContext = Object.keys(context).length > 0;
      const hasPrompt = Boolean(promptFromQuery?.trim());

      try {
        if (sessionFromQuery) {
          // Always allow reopening a past thread (setup plan or continuous chat).
          setSessionId(sessionFromQuery);
          await refreshHistory(sessionFromQuery);
          return;
        }

        if (hasPrompt || hasContext) {
          const prompt =
            (promptFromQuery && promptFromQuery.trim())
            || (context.intelligenceCandidateId
              ? "Explain this Needs Attention item and recommend the next governed step."
              : context.workId
                ? "Help me complete this Work item with a clear outcome."
                : context.personId || context.partyId
                  ? "What should I know about this person, and what is the next action?"
                  : context.subjectId
                    ? "What needs attention on this property or subject?"
                    : context.employeeId
                      ? "What is this teammate working on?"
                      : "What should I focus on in this business right now?");

          const data = hasInstalledOs
            ? await startContinuousSession({ businessId, prompt, context })
            : await startDiscoverySession({ businessId, prompt, businessName: scope.businessName });

          if (!data.ok) {
            throw Object.assign(new Error(data.error ?? data.reason ?? "Could not open Ask VIBETech."), {
              productError: data.productError ?? presentProductError(data.error ?? data.reason),
            });
          }
          const nextId = data.session?.sessionId as string | undefined;
          if (!nextId) throw new Error("No Ask VIBETech session returned.");
          if (cancelled) return;
          setSessionId(nextId);
          await refreshHistory(nextId);
          const params = new URLSearchParams({ sessionId: nextId });
          for (const [key, value] of Object.entries(context)) params.set(key, value);
          if (promptFromQuery?.trim()) params.set("prompt", promptFromQuery.trim());
          router.replace(`/b/${encodeURIComponent(businessId)}/architect?${params.toString()}`);
          return;
        }

        // Installed: leaving and returning always starts a fresh chat.
        if (hasInstalledOs) {
          const data = await startContinuousSession({
            businessId,
            prompt: "",
            context: {},
          });
          if (!data.ok) {
            throw Object.assign(new Error(data.error ?? data.reason ?? "Could not open Ask VIBETech."), {
              productError: data.productError ?? presentProductError(data.error ?? data.reason),
            });
          }
          const nextId = data.session?.sessionId as string | undefined;
          if (!nextId) throw new Error("No Ask VIBETech session returned.");
          if (cancelled) return;
          setSessionId(nextId);
          await refreshHistory(nextId);
          router.replace(`/b/${encodeURIComponent(businessId)}/architect?sessionId=${encodeURIComponent(nextId)}`);
          return;
        }

        const response = await fetch(`/api/builder/sessions?businessId=${encodeURIComponent(businessId)}`);
        const data = await response.json();
        if (cancelled) return;
        const resumeId = pickResumableSessionId(data?.sessions, { continuousOnly: false });
        if (resumeId) {
          setSessionId(resumeId);
          await refreshHistory(resumeId);
          router.replace(`/b/${encodeURIComponent(businessId)}/architect?sessionId=${encodeURIComponent(resumeId)}`);
        } else {
          setSessionId(null);
          await refreshHistory(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as any)?.productError ?? presentProductError(err));
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [
    businessId,
    sessionFromQuery,
    router,
    searchParams,
    hasInstalledOs,
    scope.businessName,
    refreshHistory,
    bootKey,
  ]);

  const [sessionContinuous, setSessionContinuous] = useState(hasInstalledOs);

  const startNewChat = useCallback(async () => {
    setHistoryBusy(true);
    setError(null);
    try {
      const data = hasInstalledOs
        ? await startContinuousSession({ businessId, prompt: "", context: {} })
        : await startDiscoverySession({
          businessId,
          prompt: "",
          businessName: scope.businessName,
        });
      if (!data.ok) {
        throw Object.assign(new Error(data.error ?? data.reason ?? "Could not start a new chat."), {
          productError: data.productError ?? presentProductError(data.error ?? data.reason),
        });
      }
      const nextId = data.session?.sessionId as string | undefined;
      if (!nextId) throw new Error("No Ask VIBETech session returned.");
      setSessionId(nextId);
      setSessionContinuous(hasInstalledOs);
      await refreshHistory(nextId);
      router.replace(`/b/${encodeURIComponent(businessId)}/architect?sessionId=${encodeURIComponent(nextId)}`);
    } catch (err) {
      setError((err as any)?.productError ?? presentProductError(err));
    } finally {
      setHistoryBusy(false);
    }
  }, [businessId, hasInstalledOs, refreshHistory, router, scope.businessName]);

  useEffect(() => {
    function onAskNewChat() {
      void startNewChat();
    }
    window.addEventListener(ASK_NEW_CHAT_EVENT, onAskNewChat);
    return () => window.removeEventListener(ASK_NEW_CHAT_EVENT, onAskNewChat);
  }, [startNewChat]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      if (!hasInstalledOs) {
        if (!cancelled) setSessionContinuous(false);
        return;
      }
      const kind = history.find((item) => item.sessionId === sessionId)?.kind;
      if (kind === "setup") {
        if (!cancelled) setSessionContinuous(false);
        return;
      }
      if (kind === "chat") {
        if (!cancelled) setSessionContinuous(true);
        return;
      }
      const continuous = await sessionIsContinuous(sessionId);
      if (!cancelled) setSessionContinuous(continuous !== false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, hasInstalledOs, history]);

  async function removeChat(targetId: string) {
    setHistoryBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(targetId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw Object.assign(new Error(data.error ?? "Could not remove that conversation."), {
          productError: data.productError ?? presentProductError(data.error),
        });
      }
      if (targetId === sessionId) {
        await startNewChat();
      } else {
        await refreshHistory(sessionId);
      }
    } catch (err) {
      setError((err as any)?.productError ?? presentProductError(err));
    } finally {
      setHistoryBusy(false);
    }
  }

  function openPastChat(nextId: string) {
    const kind = history.find((item) => item.sessionId === nextId)?.kind;
    setSessionContinuous(kind === "setup" ? false : hasInstalledOs);
    setSessionId(nextId);
    void refreshHistory(nextId);
    router.replace(`/b/${encodeURIComponent(businessId)}/architect?sessionId=${encodeURIComponent(nextId)}`);
  }

  if (error) {
    return (
      <ArchitectShell maxWidth={720} fullBleed={hasInstalledOs}>
        <ArchitectPanel>
          <ProductErrorBanner
            error={error}
            onRetry={error.canRetry ? () => {
              setError(null);
              setSessionId(null);
              setBooting(true);
              setBootKey((key) => key + 1);
            } : undefined}
          />
        </ArchitectPanel>
      </ArchitectShell>
    );
  }

  if (booting && !sessionId) {
    return (
      <ArchitectShell maxWidth={1100} fullBleed={hasInstalledOs}>
        <ArchitectPanel style={{ display: "grid", gap: 14 }}>
          <div role="status" aria-live="polite">
            <ThinkingDots label="Opening Ask VIBETech" />
          </div>
          <ArchitectSkeleton height={28} width="40%" />
          <ArchitectSkeleton height={160} />
        </ArchitectPanel>
      </ArchitectShell>
    );
  }

  if (!sessionId) {
    return (
      <ArchitectShell maxWidth={1280} fullBleed={hasInstalledOs}>
        <div className="ask-history-layout">
          <AskHistorySidebar
            items={history}
            activeSessionId={null}
            busy={historyBusy || booting}
            onNewChat={() => void startNewChat()}
            onOpen={openPastChat}
            onRemove={(id) => void removeChat(id)}
          />
          <ArchitectPanel style={{ display: "grid", gap: 18, padding: "32px 28px" }}>
            <div>
              <h1 style={{
                margin: "0 0 8px",
                fontFamily: architect.display,
                fontSize: "clamp(1.6rem, 3vw, 2.1rem)",
                letterSpacing: "-0.02em",
              }}>
                Ask VIBETech
              </h1>
              <p style={{ margin: 0, color: architect.inkMuted, lineHeight: 1.55 }}>
                Tell VIBETech about your business. It will recommend how to run it — nothing goes live until you approve.
                Past plans stay in Conversations so you can reopen them anytime.
              </p>
            </div>
            <AskVibeTechPrompt businessId={businessId} large showSuggestions={false} />
          </ArchitectPanel>
        </div>
        <style>{askHistoryLayoutCss}</style>
      </ArchitectShell>
    );
  }

  return (
    <ArchitectShell maxWidth={1280} fullBleed={hasInstalledOs}>
      <div className="ask-history-layout">
        <AskHistorySidebar
          items={history}
          activeSessionId={sessionId}
          busy={historyBusy || booting}
          onNewChat={() => void startNewChat()}
          onOpen={openPastChat}
          onRemove={(id) => void removeChat(id)}
        />
        <div style={{ minWidth: 0 }}>
          <ArchitectWorkspace
            key={sessionId}
            sessionId={sessionId}
            continuous={sessionContinuous}
            businessId={businessId}
            embedded
            onSessionMutated={() => {
              void refreshHistory(sessionId);
            }}
          />
        </div>
      </div>
      <style>{askHistoryLayoutCss}</style>
    </ArchitectShell>
  );
}

const askHistoryLayoutCss = `
  .ask-history-layout {
    display: grid;
    grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }
  @media (max-width: 860px) {
    .ask-history-layout {
      grid-template-columns: 1fr;
    }
  }
`;

async function sessionIsContinuous(sessionId: string): Promise<boolean | "unknown"> {
  try {
    const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`);
    if (!response.ok) return "unknown";
    const data = await response.json().catch(() => null);
    if (!data) return "unknown";
    return isContinuousImproveSession(data?.session ?? data);
  } catch {
    return "unknown";
  }
}

async function startContinuousSession({
  businessId,
  prompt,
  context,
}: {
  businessId: string;
  prompt: string;
  context: Record<string, string>;
}) {
  const response = await fetch(
    `/api/businesses/${encodeURIComponent(businessId)}/builder/improve`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: prompt || "__new__", ...context }),
    },
  );
  return response.json();
}

async function startDiscoverySession({
  businessId,
  prompt,
  businessName,
}: {
  businessId: string;
  prompt: string;
  businessName?: string;
}) {
  const response = await fetch("/api/builder/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "new_business",
      businessId,
      businessName: businessName || null,
      description: prompt,
    }),
  });
  return response.json();
}
