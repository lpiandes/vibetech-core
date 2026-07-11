"use client";

import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import EntityAvatar from "@/components/shell/EntityAvatar";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  OrganizationChart,
  EmployeeCards,
  TeamDirectory,
} from "@/components/universal";

type OrgView = {
  hasOrganization: boolean;
  departments: Array<{ id: string; label: string; purpose?: string }>;
  teams: Array<{ id: string; label: string; departmentId?: string | null }>;
  humanRoles: Array<{ id: string; label: string; membershipRole?: string; reportsTo?: string | null }>;
  humans: Array<{ id: string; label: string; detail?: string; email?: string | null }>;
  aiEmployees: Array<{
    id: string;
    label: string;
    detail?: string;
    archetypeId?: string | null;
    responsibilities?: string[];
    reportsTo?: string | null;
  }>;
  reportingLines: Array<Record<string, unknown>>;
  coverageRules: Array<Record<string, unknown>>;
  responsibilities: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  kpis: Array<Record<string, unknown>>;
  knowledgeOwnership: Array<Record<string, unknown>>;
  metrics: Array<{ id: string; label: string; value: string | number }>;
};

/**
 * Organization workspace — departments, teams, humans, AI employees, reporting, coverage.
 * Uses universal components; no industry-specific UI.
 */
export default function OrganizationWorkspace({ organization }: { organization: OrgView }) {
  if (!organization?.hasOrganization) {
    return (
      <ShellPanel title="Organization" subtitle="Workforce structure">
        <div style={{ padding: spacing.md, color: cockpitColors.textMuted, lineHeight: 1.5 }}>
          Architect will recommend departments, roles, and reusable AI employees when a Business OS is designed.
          Invite humans anytime — AI positions appear after install.
        </div>
      </ShellPanel>
    );
  }

  const chartItems = [
    ...organization.humanRoles.map((role) => ({
      id: role.id,
      name: role.label,
      roleLabel: role.membershipRole ?? "Role",
      depth: role.reportsTo ? 1 : 0,
      reportsToLabel: role.reportsTo ?? "",
    })),
    ...organization.aiEmployees.map((employee) => ({
      id: employee.id,
      name: employee.label,
      roleLabel: employee.archetypeId ? String(employee.archetypeId).replace(/_/g, " ") : "AI employee",
      depth: 2,
      reportsToLabel: employee.reportsTo ?? "",
    })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <ShellMetricStrip metrics={organization.metrics as never} />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="Departments" subtitle="How the business is organized">
          {organization.departments.length ? organization.departments.map((department) => (
            <Row key={department.id} title={department.label} detail={department.purpose} badge="Department" />
          )) : <Empty text="No departments yet." />}
        </ShellPanel>

        <ShellPanel title="Teams" subtitle="Operating groups">
          {organization.teams.length ? organization.teams.map((team) => (
            <Row key={team.id} title={team.label} detail={team.departmentId ? `Dept: ${team.departmentId}` : ""} badge="Team" />
          )) : <Empty text="No teams yet." />}
        </ShellPanel>

        <ShellPanel title="Coverage" subtitle="Absence and fallback">
          {organization.coverageRules.length ? organization.coverageRules.map((rule, index) => (
            <Row
              key={String(rule.when ?? index)}
              title={String(rule.when ?? "Coverage rule").replace(/_/g, " ")}
              detail={`Fallback: ${String(rule.fallback ?? "—")}`}
              badge="Rule"
            />
          )) : <Empty text="No coverage rules yet." />}
        </ShellPanel>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: spacing.md,
      }}>
        <TeamDirectory
          title="Humans"
          subtitle="People in the business"
          items={organization.humans.map((human) => ({
            id: human.id,
            name: human.label,
            roleLabel: human.detail,
            email: human.email,
            kind: "Human",
          }))}
          emptyTitle="No humans yet"
          emptyDescription="Invite teammates to fill human positions."
        />
        <EmployeeCards
          title="AI employees"
          subtitle="Reusable archetypes on duty"
          items={organization.aiEmployees.map((employee) => ({
            id: employee.id,
            name: employee.label,
            purpose: employee.detail,
            status: "ready",
            statusLabel: employee.archetypeId ? String(employee.archetypeId).replace(/_/g, " ") : "AI",
          }))}
          emptyTitle="No AI employees"
          emptyDescription="Architect will recommend reusable AI archetypes for this business."
        />
      </div>

      <OrganizationChart
        title="Reporting lines"
        subtitle="Humans and AI employees"
        items={chartItems}
        emptyTitle="No reporting structure"
        emptyDescription="Reporting lines appear when Architect designs the workforce."
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="Responsibilities" subtitle="Who owns what">
          {organization.responsibilities.length ? organization.responsibilities.slice(0, 12).map((item, index) => (
            <Row
              key={`${item.ownerId}-${index}`}
              title={String(item.text ?? "")}
              detail={`${String(item.ownerKind ?? "")}: ${String(item.ownerId ?? "")}`}
            />
          )) : (
            organization.aiEmployees.flatMap((employee) =>
              (employee.responsibilities ?? []).map((text, index) => (
                <Row key={`${employee.id}-${index}`} title={text} detail={employee.label} />
              )),
            )
          )}
          {!organization.responsibilities.length && !organization.aiEmployees.some((e) => e.responsibilities?.length) ? (
            <Empty text="Responsibilities appear with the workforce design." />
          ) : null}
        </ShellPanel>

        <ShellPanel title="Approvals & escalations" subtitle="Human-in-the-loop">
          {organization.approvals.length ? organization.approvals.slice(0, 10).map((item, index) => (
            <Row
              key={`${item.ownerId}-${index}`}
              title={String(item.requires ?? "Approval").replace(/_/g, " ")}
              detail={`Escalate to ${String(item.escalateTo ?? "manager")}`}
              badge="Approval"
            />
          )) : <Empty text="Approval chains appear with AI employee design." />}
        </ShellPanel>

        <ShellPanel title="KPI ownership" subtitle="Measured outcomes">
          {organization.kpis.length ? organization.kpis.slice(0, 10).map((item, index) => (
            <Row
              key={`${item.ownerId}-${index}`}
              title={String(item.kpi ?? "").replace(/_/g, " ")}
              detail={`${String(item.ownerKind ?? "")}: ${String(item.ownerId ?? "")}`}
              badge="KPI"
            />
          )) : <Empty text="KPI ownership appears with the workforce design." />}
        </ShellPanel>

        <ShellPanel title="Knowledge ownership" subtitle="Who keeps truth current">
          {organization.knowledgeOwnership.length ? organization.knowledgeOwnership.slice(0, 10).map((item, index) => (
            <Row
              key={`${item.ownerId}-${index}`}
              title={String(item.category ?? "").replace(/_/g, " ")}
              detail={`Owner: ${String(item.ownerId ?? "")}`}
              badge="Knowledge"
            />
          )) : <Empty text="Knowledge ownership appears with AI positions." />}
        </ShellPanel>
      </div>
    </div>
  );
}

function Row({ title, detail, badge }: { title: string; detail?: string; badge?: string }) {
  return (
    <div style={{
      display: "flex",
      gap: spacing.sm,
      alignItems: "flex-start",
      padding: `${spacing.sm} ${spacing.md}`,
      borderBottom: `1px solid ${cockpitColors.panelBorder}`,
    }}>
      <EntityAvatar name={title || "Item"} kind="person" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{title}</div>
        {detail ? (
          <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{detail}</div>
        ) : null}
      </div>
      {badge ? <StatusBadge label={badge} tone="neutral" /> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{
      padding: spacing.md,
      color: cockpitColors.textMuted,
      fontSize: typography.caption.fontSize,
      lineHeight: 1.5,
      borderRadius: radius.medium,
    }}>
      {text}
    </div>
  );
}
