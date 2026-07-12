"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ArchitectWorkspace from "./ArchitectWorkspace";
import AskVibeTechPrompt from "@/components/operating/AskVibeTechPrompt";
import {
  ArchitectPanel,
  ArchitectShell,
  ArchitectSkeleton,
  ThinkingDots,
} from "./ArchitectPrimitives";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";
import { architect } from "./architectTheme";

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
 * Only starts a Builder session when there is a prompt or context — otherwise
 * shows a conversational composer (no silent session mutation).
 */
export default function InBusinessArchitect({ businessId }: { businessId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionFromQuery = searchParams.get("sessionId");
  const [sessionId, setSessionId] = useState<string | null>(sessionFromQuery);
  const [error, setError] = useState<ProductErrorView | null>(null);
  const [booting, setBooting] = useState(Boolean(sessionFromQuery) || hasIntent(searchParams));

  useEffect(() => {
    if (sessionFromQuery) {
      setSessionId(sessionFromQuery);
      setBooting(false);
      return;
    }

    const promptFromQuery = searchParams.get("prompt");
    const context: Record<string, string> = {};
    for (const key of CONTEXT_KEYS) {
      const value = searchParams.get(key);
      if (value) context[key] = value;
    }
    const hasContext = Object.keys(context).length > 0;
    const hasPrompt = Boolean(promptFromQuery?.trim());

    if (!hasPrompt && !hasContext) {
      // Resume latest continuous session if one exists; otherwise stay on composer.
      let cancelled = false;
      void (async () => {
        try {
          const response = await fetch(`/api/builder/sessions?businessId=${encodeURIComponent(businessId)}`);
          const data = await response.json();
          if (cancelled) return;
          const resumeId = pickContinuousSessionId(data?.sessions);
          if (resumeId) {
            setSessionId(resumeId);
            router.replace(`/b/${encodeURIComponent(businessId)}/architect?sessionId=${encodeURIComponent(resumeId)}`);
          }
        } catch {
          /* composer remains available */
        } finally {
          if (!cancelled) setBooting(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    setBooting(true);
    void (async () => {
      try {
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

        const response = await fetch(
          `/api/businesses/${encodeURIComponent(businessId)}/builder/improve`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt, ...context }),
          },
        );
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw Object.assign(new Error(data.error ?? data.reason ?? "Could not open Ask VIBETech."), {
            productError: data.productError ?? presentProductError(data.error ?? data.reason),
          });
        }
        const nextId = data.session?.sessionId as string | undefined;
        if (!nextId) throw new Error("No Ask VIBETech session returned.");
        if (cancelled) return;
        setSessionId(nextId);
        const params = new URLSearchParams({ sessionId: nextId });
        for (const [key, value] of Object.entries(context)) params.set(key, value);
        if (promptFromQuery?.trim()) params.set("prompt", promptFromQuery.trim());
        router.replace(`/b/${encodeURIComponent(businessId)}/architect?${params.toString()}`);
      } catch (err) {
        if (!cancelled) {
          setError((err as any)?.productError ?? presentProductError(err));
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, sessionFromQuery, router, searchParams]);

  if (error) {
    return (
      <ArchitectShell maxWidth={720}>
        <ArchitectPanel>
          <ProductErrorBanner error={error} />
        </ArchitectPanel>
      </ArchitectShell>
    );
  }

  if (booting && !sessionId) {
    return (
      <ArchitectShell maxWidth={1100}>
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
      <ArchitectShell maxWidth={720}>
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
              Talk about your business like you would with an executive partner. Nothing goes live until you approve.
            </p>
          </div>
          <AskVibeTechPrompt businessId={businessId} large showSuggestions />
        </ArchitectPanel>
      </ArchitectShell>
    );
  }

  return (
    <ArchitectWorkspace
      sessionId={sessionId}
      continuous
      businessId={businessId}
    />
  );
}

function hasIntent(searchParams: URLSearchParams) {
  if (searchParams.get("prompt")?.trim()) return true;
  return CONTEXT_KEYS.some((key) => Boolean(searchParams.get(key)));
}

function pickContinuousSessionId(sessions: unknown): string | null {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  const continuous = sessions.find((row: any) =>
    row?.metadata?.continuousImprovement
    || row?.continuousImprovement
    || /improve|continuous/i.test(String(row?.mode ?? row?.title ?? "")),
  );
  const pick = continuous ?? sessions[0];
  return pick?.sessionId ? String(pick.sessionId) : null;
}
