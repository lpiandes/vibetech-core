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

/**
 * Permanent Ask VIBETech surface under /b/[businessId]/architect.
 * Starts or resumes a continuous-improvement session bound to the business.
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
        const response = await fetch(
          `/api/businesses/${encodeURIComponent(businessId)}/builder/improve`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt: "Improve this business" }),
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
        router.replace(`/b/${encodeURIComponent(businessId)}/architect?sessionId=${encodeURIComponent(nextId)}`);
      } catch (err) {
        if (!cancelled) {
          setError((err as any)?.productError ?? presentProductError(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, sessionFromQuery, router]);

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
          <ThinkingDots label="Opening Ask VIBETech" />
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
