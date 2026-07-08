"use client";

import { useAutomationsViewModel } from "./AutomationsContext";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveGrid from "@/components/executive/ExecutiveGrid";
import MetricCard from "@/components/executive/MetricCard";
import StatusPill from "@/components/executive/StatusPill";
import { semanticColors, spacing } from "@/design/tokens";

function safeArray(v: any) {
  return Array.isArray(v) ? v : [];
}

export default function AutomationsExecutiveLayout() {
  const vm = useAutomationsViewModel();
  const identity = vm?.productContext?.identity ?? {};
  const title = vm?.title ?? identity?.pageLabels?.automationsPageTitle ?? "Automations";

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

          {safeArray(vm.automations).map((automation: any) => (
            <ExecutiveCard key={String(automation.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md }}>
                <ExecutiveHeader title={String(automation.name)} subtitle={`${automation.triggerSummary} · ${automation.actionSummary}`} />
                <StatusPill tone={automation.pendingApprovals > 0 ? "warning" : "neutral"} label={String(automation.status)} />
              </div>
              <div style={{ marginTop: spacing.md, color: semanticColors.textSecondary }}>
                Runs: {automation.runCount} · Last: {automation.lastRunStatus ?? "none"} · Approval required: {automation.requiresApproval ? "yes" : "no"}
              </div>
            </ExecutiveCard>
          ))}

          <ExecutiveCard>
            <ExecutiveHeader title="Recent Runs" subtitle="Read-only automation history" />
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
