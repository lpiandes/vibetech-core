"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cockpitColors, spacing, radius, motion } from "@/design/tokens";
import {
  evaluateOwnerSetupSteps,
  presentConsultingSetup,
  resolveOwnerSetupPath,
} from "../../../backend/core/platform/commercial/resolveOwnerSetupPath.js";
import {
  PackageSetupProgressBar,
  setupJourneyKeyframes,
} from "@/components/connections/setupJourneyUi";

function hrefForStep(businessId: string, step: { href?: string | null; focusConnectionId?: string | null }) {
  const base = `/b/${encodeURIComponent(businessId)}`;
  if (step.href === "knowledge") return `${base}/knowledge`;
  if (step.href === "integrations") {
    const focus = step.focusConnectionId
      ? `?focus=${encodeURIComponent(step.focusConnectionId)}`
      : "";
    return `${base}/integrations${focus}`;
  }
  return `${base}/integrations`;
}

/**
 * Plain-English package checklist on Today (Connect → Test it → Go live).
 */
export default function PackageSetupPath({
  businessId,
  purchasedPackages = [],
  connectionStatuses = {},
  proofRecords = {},
  knowledgeCount = 0,
  packageSetupGoLiveAt = null,
  packageSetupById = null,
  pendingOpsRequests = {},
  mode = null,
}: {
  businessId: string;
  purchasedPackages?: string[];
  connectionStatuses?: Record<string, unknown>;
  proofRecords?: Record<string, { ok?: boolean; verified?: boolean }>;
  knowledgeCount?: number;
  packageSetupGoLiveAt?: string | null;
  packageSetupById?: Record<string, { goLiveAt?: string | null }> | null;
  pendingOpsRequests?: Record<string, unknown>;
  mode?: "package" | "consulting" | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localGoLiveById, setLocalGoLiveById] = useState<Record<string, string>>({});

  const path = useMemo(
    () => resolveOwnerSetupPath({
      purchasedPackages,
      packageSetupGoLiveAt,
      packageSetupById: {
        ...(packageSetupById ?? {}),
        ...Object.fromEntries(
          Object.entries(localGoLiveById).map(([id, at]) => [id, { goLiveAt: at }]),
        ),
      },
    }),
    [purchasedPackages, packageSetupGoLiveAt, packageSetupById, localGoLiveById],
  );

  const effectiveMode = mode ?? path.mode;

  const views = useMemo(() => {
    if (effectiveMode === "consulting") {
      return [presentConsultingSetup(path.primaryPackageId)];
    }
    const ids = path.packageIds?.length ? path.packageIds : (path.primaryPackageId ? [path.primaryPackageId] : []);
    return ids.map((packageId: string) => {
      const goLiveAt = localGoLiveById[packageId]
        ?? packageSetupById?.[packageId]?.goLiveAt
        ?? (ids.length === 1 ? packageSetupGoLiveAt : null);
      return evaluateOwnerSetupSteps({
        packageId,
        connectionStatuses,
        proofRecords,
        knowledgeCount,
        goLiveAt: goLiveAt ? String(goLiveAt) : undefined,
        pendingOpsRequests,
      } as any);
    });
  }, [
    effectiveMode,
    path.packageIds,
    path.primaryPackageId,
    connectionStatuses,
    proofRecords,
    knowledgeCount,
    packageSetupById,
    packageSetupGoLiveAt,
    localGoLiveById,
    pendingOpsRequests,
  ]);

  const goLive = useCallback(async (packageId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/package-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "go_live", packageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error ?? "Could not go live yet.");
      }
      const at = String(data.goLiveAt ?? new Date().toISOString());
      setLocalGoLiveById((prev) => ({ ...prev, [packageId]: at }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [businessId, router]);

  if (!views.length) return null;

  return (
    <section
      aria-label="Get set up"
      style={{
        display: "grid",
        gap: spacing.md,
        padding: "20px 20px 18px",
        borderRadius: 20,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: `
          radial-gradient(ellipse 70% 80% at 0% 0%, rgba(34,211,238,0.12), transparent 55%),
          linear-gradient(165deg, #0b1220 0%, ${cockpitColors.panel} 60%)
        `,
        boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: setupJourneyKeyframes }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.accent }}>
          Today
        </div>
        <h2 style={{ margin: "6px 0 0", fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em", color: cockpitColors.textPrimary }}>
          Get set up
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
          Connect → Test it → Go live. Nothing customer-facing runs until you finish.
        </p>
      </div>

      {error ? (
        <p style={{ margin: 0, color: cockpitColors.critical, fontSize: 13 }}>{error}</p>
      ) : null}

      {views.map((view: {
        packageId?: string | null;
        title?: string;
        summary?: { completeCount?: number; totalSteps?: number; nextStepId?: string | null; canGoLive?: boolean };
        steps: Array<Record<string, unknown>>;
      }) => {
        const nextId = view.summary?.nextStepId;
        return (
          <div key={view.packageId ?? view.title} style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <div style={{ fontWeight: 750, fontSize: 15, color: cockpitColors.textPrimary }}>
                {view.title}
              </div>
            </div>
            <PackageSetupProgressBar
              complete={Number(view.summary?.completeCount ?? 0)}
              total={Number(view.summary?.totalSteps ?? 0)}
            />
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {view.steps.map((step: any, index: number) => {
                const done = Boolean(step.complete);
                const isNext = !done && step.id === nextId;
                const link = step.href ? hrefForStep(businessId, step) : null;
                return (
                  <li
                    key={step.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: done
                        ? "rgba(52,211,153,0.08)"
                        : isNext
                          ? "rgba(34,211,238,0.10)"
                          : cockpitColors.panelElevated,
                      border: `1px solid ${
                        done
                          ? "rgba(52,211,153,0.35)"
                          : isNext
                            ? "rgba(34,211,238,0.45)"
                            : cockpitColors.panelBorder
                      }`,
                      boxShadow: isNext ? "0 0 0 1px rgba(34,211,238,0.12)" : undefined,
                      animation: isNext ? "vtSetupPulse 2.4s ease-in-out infinite" : undefined,
                      transition: `border-color ${motion.normal} ${motion.easing.soft}`,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 800,
                        background: done
                          ? "rgba(52,211,153,0.9)"
                          : isNext
                            ? cockpitColors.accent
                            : "rgba(15,23,42,0.9)",
                        color: done || isNext ? "#041018" : cockpitColors.textMuted,
                        border: `1px solid ${done ? "rgba(52,211,153,0.6)" : isNext ? "rgba(34,211,238,0.5)" : cockpitColors.panelBorder}`,
                      }}
                    >
                      {done ? "✓" : index + 1}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, color: cockpitColors.textPrimary, fontSize: 14 }}>
                        {step.label}
                        {isNext ? (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 750, color: cockpitColors.accent }}>
                            Next up
                          </span>
                        ) : null}
                      </div>
                      {step.detail ? (
                        <div style={{ marginTop: 3, fontSize: 13, color: cockpitColors.textSecondary, lineHeight: 1.4 }}>
                          {step.detail}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {step.kind === "go_live" && !done ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy || !view.summary?.canGoLive}
                          onClick={() => void goLive(String(view.packageId))}
                        >
                          {busy ? "…" : "Go live"}
                        </Button>
                      ) : link && !done && step.kind !== "consulting" ? (
                        <Button type="button" size="sm" variant={isNext ? "default" : "secondary"} asChild>
                          <Link href={link}>{step.kind === "test" ? "Test it" : "Open"}</Link>
                        </Button>
                      ) : done ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.handled }}>Done</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
