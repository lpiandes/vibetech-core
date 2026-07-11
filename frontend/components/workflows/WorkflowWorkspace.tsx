"use client";

import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing } from "@/design/tokens";
import {
  Tables,
  DataGrid,
  Timeline,
  StatusBadges,
  InsightCards,
  MetricCards,
} from "@/components/universal";

type WorkflowView = {
  hasWorkflows: boolean;
  workflows: Array<{
    id: string;
    label: string;
    archetypeId?: string | null;
    status: string;
    trigger?: string | null;
    stageCount: number;
    approvalCount: number;
    escalationCount: number;
    stages: Array<{
      id: string;
      label: string;
      assignment?: string;
      approvalRequired?: boolean;
      actions?: string[];
    }>;
    version?: number;
  }>;
  active: Array<{ id: string; label: string; status: string; kind?: string }>;
  pendingApprovals: Array<{ id: string; label: string; workflowId: string; status: string }>;
  automations: Array<{ id: string; label: string; status: string; trigger?: string | null }>;
  history: Array<{ id: string; label: string; detail?: string }>;
  metrics: Array<{ id: string; label: string; value: string | number }>;
};

/**
 * Workflow workspace — active flows, approvals, automation, history, performance.
 * Visual only — never exposes raw workflow JSON.
 */
export default function WorkflowWorkspace({ workflows }: { workflows: WorkflowView }) {
  if (!workflows?.hasWorkflows) {
    return (
      <ShellPanel title="Workflows" subtitle="Automation">
        <div style={{ padding: spacing.md, color: cockpitColors.textMuted, lineHeight: 1.5 }}>
          Architect will recommend workflows, stages, approvals, and escalations when a Business OS is designed.
          Active work and automation status appear here.
        </div>
      </ShellPanel>
    );
  }

  const flowItems = workflows.workflows.flatMap((workflow) => (
    workflow.stages.length
      ? workflow.stages.map((stage, index) => ({
        id: `${workflow.id}_${stage.id}`,
        label: stage.label,
        detail: `${workflow.label} · ${stage.assignment ?? "unassigned"}`,
        status: stage.approvalRequired ? "approval" : "stage",
        order: index,
      }))
      : [{
        id: workflow.id,
        label: workflow.label,
        detail: `${workflow.trigger ?? "manual"} · ${workflow.stageCount} stages`,
        status: workflow.status,
        order: 0,
      }]
  ));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <ShellMetricStrip metrics={workflows.metrics as never} />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="Active workflows" subtitle="What is running">
          <InsightCards items={workflows.active.map((item) => ({
            id: item.id,
            label: item.label,
            summary: item.status,
          }))} />
        </ShellPanel>

        <ShellPanel title="Pending approvals" subtitle="Human gates">
          {workflows.pendingApprovals.length ? workflows.pendingApprovals.map((approval) => (
            <div key={approval.id} style={{
              display: "flex",
              justifyContent: "space-between",
              gap: spacing.sm,
              padding: `${spacing.xs}px 0`,
              borderBottom: `1px solid ${cockpitColors.panelBorder}`,
            }}>
              <span>{approval.label}</span>
              <StatusBadge label={approval.status} tone="warning" />
            </div>
          )) : (
            <div style={{ color: cockpitColors.textMuted }}>No approvals pending.</div>
          )}
        </ShellPanel>

        <ShellPanel title="Automation status" subtitle="Armed and gated">
          <StatusBadges items={workflows.automations.map((auto) => ({
            id: auto.id,
            label: `${auto.label}: ${auto.status}`,
          }))} />
        </ShellPanel>
      </div>

      <ShellPanel title="Flow" subtitle="Stages · assignments · actions">
        <Timeline items={flowItems.slice(0, 16).map((item) => ({
          id: item.id,
          label: item.label,
          summary: item.detail,
        }))} />
      </ShellPanel>

      <ShellPanel title="Workflow catalog" subtitle="Reusable archetypes">
        <Tables
          items={workflows.workflows.map((workflow) => ({
            id: workflow.id,
            name: workflow.label,
            trigger: workflow.trigger ?? "manual",
            stages: String(workflow.stageCount),
            version: `v${workflow.version ?? 1}`,
          }))}
          columns={[
            { id: "name", label: "Workflow" },
            { id: "trigger", label: "Trigger" },
            { id: "stages", label: "Stages" },
            { id: "version", label: "Version" },
          ]}
        />
      </ShellPanel>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="History" subtitle="Recommended and installed">
          <DataGrid
            items={workflows.history.map((entry) => ({
              id: entry.id,
              label: entry.label,
              status: entry.detail ?? "",
            }))}
            columns={[
              { id: "label", label: "Workflow" },
              { id: "status", label: "Detail" },
            ]}
          />
        </ShellPanel>

        <ShellPanel title="Performance" subtitle="Counts at a glance">
          <MetricCards items={workflows.metrics.map((metric) => ({
            id: metric.id,
            label: metric.label,
            value: metric.value,
          }))} />
        </ShellPanel>
      </div>
    </div>
  );
}
