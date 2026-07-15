"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAutomationsViewModel } from "./AutomationsContext";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveGrid from "@/components/executive/ExecutiveGrid";
import MetricCard from "@/components/executive/MetricCard";
import StatusPill from "@/components/executive/StatusPill";
import SecondaryButton from "@/components/product/SecondaryButton";
import { semanticColors, spacing } from "@/design/tokens";

function safeArray(v: any) {
  return Array.isArray(v) ? v : [];
}

export default function AutomationsExecutiveLayout() {
  const vm = useAutomationsViewModel();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const identity = vm?.productContext?.identity ?? {};
  const title = vm?.title ?? identity?.pageLabels?.automationsPageTitle ?? "Automations";
  const businessId = String(vm?.productContext?.businessId ?? vm?.businessId ?? "");

  async function toggleAutomation(automation: { id?: string; status?: string }) {
    if (!businessId || !automation.id) return;
    const current = String(automation.status ?? "").toUpperCase();
    const next = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setPendingId(String(automation.id));
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/automations/${encodeURIComponent(String(automation.id))}/status`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Could not update automation");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update automation");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div style={{ padding: spacing.xl }}>
      <ExecutiveSurface>
        <ExecutiveStack gap="lg">
          <ExecutiveHeader title={title} subtitle="What is the business doing automatically?" />

          <ExecutiveGrid columns={3}>
            <MetricCard title="Installed" value={vm.summary?.installed ?? 0} status="recorded" priority="Later" />
            <MetricCard title="Active" value={vm.summary?.active ?? 0} status="recorded" priority="Later" />
            <MetricCard title="Pending approvals" value={vm.summary?.pendingApprovals ?? 0} status="recorded" priority="Immediate" />
            <MetricCard title="Failed runs" value={vm.summary?.failedRuns ?? 0} status="recorded" priority="Immediate" />
          </ExecutiveGrid>

          {error ? (
            <div style={{ color: semanticColors.danger ?? "#b42318" }}>{error}</div>
          ) : null}

          {safeArray(vm.automations).map((automation: any) => {
            const active = String(automation.status ?? "").toUpperCase() === "ACTIVE";
            return (
              <ExecutiveCard key={String(automation.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                  <ExecutiveHeader title={String(automation.name)} subtitle={`${automation.triggerSummary} · ${automation.actionSummary}`} />
                  <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                    <StatusPill tone={automation.pendingApprovals > 0 ? "warning" : active ? "success" : "neutral"} label={String(automation.status)} />
                    <SecondaryButton
                      onClick={() => toggleAutomation(automation)}
                    >
                      {pendingId === String(automation.id)
                        ? "Saving…"
                        : active
                          ? "Turn off"
                          : "Turn on"}
                    </SecondaryButton>
                  </div>
                </div>
                <div style={{ marginTop: spacing.md, color: semanticColors.textSecondary }}>
                  Runs: {automation.runCount} · Last: {automation.lastRunStatus ?? "none"} · Outbound sends always need approval
                </div>
              </ExecutiveCard>
            );
          })}

          <ExecutiveCard>
            <ExecutiveHeader title="Recent Runs" subtitle="Automation history" />
            <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {safeArray(vm.recentRuns).map((run: any) => (
                <div key={String(run.id)} style={{ color: semanticColors.textPrimary }}>
                  {String(run.automationId)} — {String(run.status)} — {String(run.startedAt)}
                </div>
              ))}
            </div>
          </ExecutiveCard>
        </ExecutiveStack>
      </ExecutiveSurface>
    </div>
  );
}
