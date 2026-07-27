"use client";

import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import { SimpleEmpty } from "@/components/product/SimpleUI";
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
 * Organization workspace — staff structure, humans, AI employees, reporting, coverage.
 * Uses universal components; no industry-specific UI.
 */
export default function OrganizationWorkspace({
  organization,
  canManageTeam = false,
}: {
  organization: OrgView;
  canManageTeam?: boolean;
}) {
  if (!organization?.hasOrganization) {
    return (
      <ShellPanel title="Organization">
        <SimpleEmpty>Nothing yet.</SimpleEmpty>
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
        <ShellPanel title="Departments">
          {organization.departments.length ? organization.departments.map((department) => (
            <Row key={department.id} title={department.label} detail={department.purpose} badge="Department" />
          )) : <Empty text="None yet." />}
        </ShellPanel>

        <ShellPanel title="Staff groups">
          {organization.teams.length ? organization.teams.map((team) => (
            <Row key={team.id} title={team.label} detail={team.departmentId ? `Dept: ${team.departmentId}` : ""} badge="Team" />
          )) : <Empty text="None yet." />}
        </ShellPanel>

        <ShellPanel title="Coverage">
          {organization.coverageRules.length ? organization.coverageRules.map((rule, index) => (
            <Row
              key={String(rule.when ?? index)}
              title={String(rule.when ?? "Coverage rule").replace(/_/g, " ")}
              detail={`Fallback: ${String(rule.fallback ?? "—")}`}
              badge="Rule"
            />
          )) : <Empty text="None yet." />}
        </ShellPanel>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: spacing.md,
      }}>
        <TeamDirectory
          title="Humans"
          permissions={canManageTeam ? ["team.manage"] : []}
          items={organization.humans.map((human) => ({
            id: human.id,
            name: human.label,
            roleLabel: human.detail,
            email: human.email,
            kind: "Human",
          }))}
          emptyTitle="No staff"
          emptyDescription="None yet."
        />
        <EmployeeCards
          title="AI employees"
          permissions={canManageTeam ? ["team.manage"] : []}
          items={organization.aiEmployees.map((employee) => ({
            id: employee.id,
            name: employee.label,
            purpose: employee.detail,
            status: "ready",
            statusLabel: employee.archetypeId ? String(employee.archetypeId).replace(/_/g, " ") : "AI",
          }))}
          emptyTitle="No AI employees"
          emptyDescription="None yet."
        />
      </div>

      <OrganizationChart
        title="Reporting"
        permissions={canManageTeam ? ["team.manage"] : []}
        items={chartItems}
        emptyTitle="No reporting"
        emptyDescription="None yet."
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="Responsibilities">
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
            <Empty text="None yet." />
          ) : null}
        </ShellPanel>

        <ShellPanel title="Approvals">
          {organization.approvals.length ? organization.approvals.slice(0, 10).map((item, index) => (
            <Row
              key={`${item.ownerId}-${index}`}
              title={String(item.requires ?? "Approval").replace(/_/g, " ")}
              detail={`Escalate to ${String(item.escalateTo ?? "manager")}`}
              badge="Approval"
            />
          )) : <Empty text="None yet." />}
        </ShellPanel>

        <ShellPanel title="KPIs">
          {organization.kpis.length ? organization.kpis.slice(0, 10).map((item, index) => (
            <Row
              key={`${item.ownerId}-${index}`}
              title={String(item.kpi ?? "").replace(/_/g, " ")}
              detail={`${String(item.ownerKind ?? "")}: ${String(item.ownerId ?? "")}`}
              badge="KPI"
            />
          )) : <Empty text="None yet." />}
        </ShellPanel>

        <ShellPanel title="Knowledge">
          {organization.knowledgeOwnership.length ? organization.knowledgeOwnership.slice(0, 10).map((item, index) => (
            <Row
              key={`${item.ownerId}-${index}`}
              title={String(item.category ?? "").replace(/_/g, " ")}
              detail={`Owner: ${String(item.ownerId ?? "")}`}
              badge="Knowledge"
            />
          )) : <Empty text="None yet." />}
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
