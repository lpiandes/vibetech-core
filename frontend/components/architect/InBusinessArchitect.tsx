"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ArchitectWorkspace from "./ArchitectWorkspace";
import {
  ArchitectPanel,
  ArchitectShell,
  ArchitectSkeleton,
  ThinkingDots,
} from "./ArchitectPrimitives";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";

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
 * Context query params follow the user from Home, Needs Attention, Work, Team, etc.
 */
export default function InBusinessArchitect({ businessId }: { businessId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionFromQuery = searchParams.get("sessionId");
  const [sessionId, setSessionId] = useState<string | null>(sessionFromQuery);
  const [error, setError] = useState<ProductErrorView | null>(null);

  useEffect(() => {
    if (sessionFromQuery) {
      setSessionId(sessionFromQuery);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const context: Record<string, string> = {};
        for (const key of CONTEXT_KEYS) {
          const value = searchParams.get(key);
          if (value) context[key] = value;
        }
        const prompt =
          context.intelligenceCandidateId
            ? "Explain this Needs Attention item and recommend the next governed step."
            : context.workId
              ? "Help me complete this Work item with a clear outcome."
              : context.personId || context.partyId
                ? "What should I know about this person, and what is the next action?"
                : context.subjectId
                  ? "What needs attention on this subject or property?"
                  : context.employeeId
                    ? "What is this team member or AI employee working on?"
                    : "Improve this business";

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
          throw Object.assign(new Error(data.error ?? data.reason ?? "Could not open Architect."), {
            productError: data.productError ?? presentProductError(data.error ?? data.reason),
          });
        }
        const nextId = data.session?.sessionId as string | undefined;
        if (!nextId) throw new Error("No Architect session returned.");
        if (cancelled) return;
        setSessionId(nextId);
        const params = new URLSearchParams({ sessionId: nextId });
        for (const [key, value] of Object.entries(context)) params.set(key, value);
        router.replace(`/b/${encodeURIComponent(businessId)}/architect?${params.toString()}`);
      } catch (err) {
        if (!cancelled) {
          setError((err as any)?.productError ?? presentProductError(err));
        }
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

  if (!sessionId) {
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

  return (
    <ArchitectWorkspace
      sessionId={sessionId}
      continuous
      businessId={businessId}
    />
  );
}
