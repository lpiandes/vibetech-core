"use client";

import Link from "next/link";
import { useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { TeamViewModel } from "./TeamContext";
import { TeamViewModelContext } from "./TeamContext";
import InvitePersonDialog from "./InvitePersonDialog";
import type { PlatformTeamData } from "./TeamRenderer";
import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import EntityAvatar from "@/components/shell/EntityAvatar";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import OrganizationWorkspace from "@/components/workforce/OrganizationWorkspace";
import EmployeeWorkerCard from "@/components/team/EmployeeWorkerCard";
import { copyInviteLink } from "@/lib/platform/inviteLinks";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  deriveTeamCounts,
  monitoringSummary,
  primaryEmployeeAction,
  type TeamDigitalEmployee,
} from "./teamSemantics";

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function PanelEmpty({ description }: { description: string }) {
  return (
    <div
      style={{
        padding: spacing.md,
        color: cockpitColors.textMuted,
        fontSize: typography.caption.fontSize,
        lineHeight: 1.5,
      }}
    >
      {description}
    </div>
  );
}

function HumanMemberRow({ member }: { member: { id: string; name: string; email: string; roleLabel: string } }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <EntityAvatar name={member.name} kind="person" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{member.name}</div>
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>
          {member.email}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>{member.roleLabel}</div>
        <div style={{ marginTop: 4 }}>
          <StatusBadge label="Active" tone="success" />
        </div>
      </div>
    </div>
  );
}

function DigitalEmployeeCard({ employee, businessId }: { employee: TeamDigitalEmployee; businessId: string }) {
  const action = primaryEmployeeAction(employee);
  const monitoring = monitoringSummary(employee);
  const blockers = safeArray<string>(employee.blockerItems);
  const statusLabel = String(employee.statusLabel ?? "Unknown");
  const employeeId = String(employee.id ?? employee.employeeId ?? "");
  const askHref = employee.askHref
    ?? `/b/${encodeURIComponent(businessId)}/architect?employeeId=${encodeURIComponent(employeeId)}`;
  const specialtyHref = employee.specialtyHref
    ?? (employee.ownerAdded || employee.customAiWork || employeeId.startsWith("owner_emp_")
      ? `/b/${encodeURIComponent(businessId)}/specialty/${encodeURIComponent(employeeId)}`
      : null);
  const detailHref = specialtyHref
    ?? employee.detailHref
    ?? `/b/${encodeURIComponent(businessId)}/team/${encodeURIComponent(employeeId)}`;

  return (
    <div style={{ padding: `0 0 ${spacing.md}` }}>
      <EmployeeWorkerCard
        name={String(employee.name ?? "Teammate")}
        role={String(employee.responsibility ?? employee.role ?? "")}
        status={statusLabel}
        responsibilities={employee.description ? [String(employee.description)] : undefined}
        currentWork={employee.currentHandling ? String(employee.currentHandling) : null}
        currentCustomer={
          employee.primaryParty?.displayName
          ?? employee.partyName
          ?? null
        }
        waitingFor={
          employee.needsFromOwner && !/^nothing$/i.test(String(employee.needsFromOwner))
            ? String(employee.needsFromOwner)
            : null
        }
        nextAction={specialtyHref ? "Open specialty page" : (action?.label ?? null)}
        recentOutcome={
          monitoring.length
            ? monitoring.map((m) => `${m.label}: ${m.count}`).join(" · ")
            : null
        }
        needsApproval={/approv/i.test(statusLabel)}
        blockers={blockers}
        askHref={askHref}
      />
      <div
        style={{
          padding: `0 ${spacing.lg} ${spacing.lg}`,
          display: "flex",
          flexWrap: "wrap",
          gap: spacing.sm,
          alignItems: "center",
        }}
      >
        {specialtyHref ? (
          <PrimaryButton href={specialtyHref}>Open specialty page</PrimaryButton>
        ) : (
          <Link href={detailHref} style={{ color: cockpitColors.accent, fontWeight: 600, fontSize: typography.caption.fontSize }}>
            Open teammate
          </Link>
        )}
        {action?.href && action.href !== detailHref && action.href !== specialtyHref ? (
          <Link href={action.href} style={{ color: cockpitColors.accent, fontWeight: 600, fontSize: typography.caption.fontSize }}>
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function TeamExecutiveLayout({
  platformTeam,
  organization = null,
}: {
  platformTeam?: PlatformTeamData;
  organization?: any;
}) {
  const viewModel = useContext<TeamViewModel | null>(TeamViewModelContext);
  const [showInvite, setShowInvite] = useState(false);
  const [workspace, setWorkspace] = useState<"organization" | "team">("team");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [linkLoadingId, setLinkLoadingId] = useState<string | null>(null);
  const [pendingLinks, setPendingLinks] = useState<Record<string, string>>({});
  const router = useRouter();
  if (!viewModel) return null;

  const digitalEmployees = safeArray<TeamDigitalEmployee>((viewModel as TeamViewModel & { digitalEmployees?: unknown }).digitalEmployees);
  const platformMembers = platformTeam?.members ?? [];
  const pending = platformTeam?.pending ?? [];
  const canInvite = platformTeam?.canInvite ?? false;
  const canManage = platformTeam?.canManage ?? false;
  const businessId = platformTeam?.businessId ?? "";
  const showDevInviteLinks = platformTeam?.showDevInviteLinks ?? false;

  const counts = useMemo(() => deriveTeamCounts(platformMembers, digitalEmployees), [platformMembers, digitalEmployees]);

  const metricStrip = useMemo(
    () => [
      { id: "human", label: "People", value: String(counts.humanTeam) },
      { id: "digital", label: "AI teammates", value: String(counts.digitalEmployees) },
      { id: "ready", label: "Working", value: String(counts.ready) },
      { id: "setup", label: "Getting ready", value: String(counts.needsSetup) },
    ],
    [counts],
  );

  function flashMessage(message: string) {
    setCopyMessage(message);
    window.setTimeout(() => setCopyMessage(null), 2500);
  }

  async function resendInvite(invitationId: string) {
    if (resendingId) return;
    setResendingId(invitationId);
    try {
      const res = await fetch(`/api/businesses/${businessId}/invitations/${invitationId}/resend`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashMessage(String(data.error ?? "Could not resend invitation email."));
        return;
      }
      flashMessage(data.emailSent ? "Invitation email sent." : String(data.deliveryMessage ?? "Email was not sent."));
    } finally {
      setResendingId(null);
    }
  }

  async function revokeInvite(invitationId: string) {
    if (revokingId) return;
    if (!window.confirm("Revoke this invitation? They will no longer be able to join with this link.")) return;
    setRevokingId(invitationId);
    try {
      const res = await fetch(`/api/businesses/${businessId}/invitations/${invitationId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        flashMessage(String(data.error ?? "Could not revoke invitation."));
        return;
      }
      setPendingLinks((prev) => {
        const next = { ...prev };
        delete next[invitationId];
        return next;
      });
      router.refresh();
    } finally {
      setRevokingId(null);
    }
  }

  async function resolveInviteUrlForPending(invitationId: string, existingUrl?: string | null) {
    if (existingUrl) return existingUrl;
    if (pendingLinks[invitationId]) return pendingLinks[invitationId];

    setLinkLoadingId(invitationId);
    try {
      const getRes = await fetch(`/api/businesses/${businessId}/invitations/${invitationId}/link`);
      const getData = await getRes.json().catch(() => ({}));
      if (getRes.ok && getData.inviteUrl) {
        setPendingLinks((prev) => ({ ...prev, [invitationId]: getData.inviteUrl }));
        return getData.inviteUrl as string;
      }

      const postRes = await fetch(`/api/businesses/${businessId}/invitations/${invitationId}/link`, { method: "POST" });
      const postData = await postRes.json().catch(() => ({}));
      if (!postRes.ok) {
        flashMessage(String(postData.error ?? "Could not get invitation link."));
        return null;
      }
      if (postData.inviteUrl) {
        setPendingLinks((prev) => ({ ...prev, [invitationId]: postData.inviteUrl }));
        return postData.inviteUrl as string;
      }
      return null;
    } finally {
      setLinkLoadingId(null);
    }
  }

  async function copyPendingLink(invitationId: string, existingUrl?: string | null) {
    const url = await resolveInviteUrlForPending(invitationId, existingUrl);
    if (!url) return;
    await copyInviteLink(url);
    flashMessage("Invitation link copied.");
  }

  const inviteAction = canInvite ? <PrimaryButton onClick={() => setShowInvite(true)}>+ Invite teammate</PrimaryButton> : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <PageHeader
        title="Team"
        description="People and AI teammates accountable for work in this business."
        action={inviteAction}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setWorkspace("team")}
          style={{
            borderRadius: 999,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: workspace === "team" ? cockpitColors.accent : cockpitColors.panel,
            color: workspace === "team" ? "#fff" : cockpitColors.textPrimary,
            padding: "8px 14px",
            fontWeight: 650,
            cursor: "pointer",
          }}
        >
          Team roster
        </button>
        <button
          type="button"
          onClick={() => setWorkspace("organization")}
          style={{
            borderRadius: 999,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: workspace === "organization" ? cockpitColors.accent : cockpitColors.panel,
            color: workspace === "organization" ? "#fff" : cockpitColors.textPrimary,
            padding: "8px 14px",
            fontWeight: 650,
            cursor: "pointer",
          }}
        >
          Organization
        </button>
      </div>

      {copyMessage ? (
        <p style={{ ...typography.caption, color: cockpitColors.accent, margin: 0 }}>{copyMessage}</p>
      ) : null}

      {workspace === "organization" ? (
        <OrganizationWorkspace organization={organization ?? {
          hasOrganization: platformMembers.length > 0 || digitalEmployees.length > 0,
          departments: [],
          teams: [],
          humanRoles: [],
          humans: platformMembers.map((member) => ({
            id: member.id,
            label: member.name,
            detail: member.roleLabel,
            email: member.email,
          })),
          aiEmployees: digitalEmployees.map((employee) => ({
            id: String(employee.id ?? employee.name),
            label: String(employee.name ?? "AI employee"),
            detail: String(employee.responsibility ?? employee.role ?? ""),
            responsibilities: [],
          })),
          reportingLines: [],
          coverageRules: [],
          responsibilities: [],
          approvals: [],
          kpis: [],
          knowledgeOwnership: [],
          metrics: [
            { id: "humans", label: "Humans", value: platformMembers.length },
            { id: "ai", label: "AI employees", value: digitalEmployees.length },
            { id: "departments", label: "Departments", value: 0 },
            { id: "teams", label: "Teams", value: 0 },
          ],
        }} />
      ) : null}

      {workspace === "team" ? (
        <>
      <ShellMetricStrip metrics={metricStrip} />

      <ShellPanel
        title="People"
        subtitle={`${counts.humanTeam} member${counts.humanTeam === 1 ? "" : "s"}`}
        action={platformMembers.length === 0 ? inviteAction : undefined}
      >
        {platformMembers.length === 0 ? (
          <PanelEmpty description="Invite teammates so they can access VIBETech and work alongside AI teammates." />
        ) : (
          <div>
            {platformMembers.map((member) => (
              <HumanMemberRow key={member.id} member={member} />
            ))}
          </div>
        )}
      </ShellPanel>

      {pending.length > 0 ? (
        <ShellPanel title="Pending invitations" subtitle={`${pending.length} waiting to accept`}>
          <div>
            {pending.map((invite) => (
              <div
                key={invite.id}
                style={{
                  padding: spacing.md,
                  borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: spacing.md,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{invite.email}</div>
                  <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>
                    {invite.roleLabel} · Waiting to accept
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                  <StatusBadge label="Pending" tone="warning" />
                  {showDevInviteLinks && canInvite ? (
                    <PrimaryButton onClick={() => void copyPendingLink(invite.id, invite.inviteUrl)}>
                      {linkLoadingId === invite.id ? "Getting link…" : "Copy invite link"}
                    </PrimaryButton>
                  ) : null}
                  {!showDevInviteLinks && canInvite ? (
                    <SecondaryButton onClick={() => void resendInvite(invite.id)}>
                      {resendingId === invite.id ? "Sending…" : "Resend email"}
                    </SecondaryButton>
                  ) : null}
                  {canManage ? (
                    <SecondaryButton onClick={() => void revokeInvite(invite.id)}>
                      {revokingId === invite.id ? "Revoking…" : "Revoke"}
                    </SecondaryButton>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </ShellPanel>
      ) : null}

      <ShellPanel
        title="AI teammates"
        subtitle={`${counts.digitalEmployees} teammate${counts.digitalEmployees === 1 ? "" : "s"}`}
      >
        {digitalEmployees.length === 0 ? (
          <PanelEmpty description="Your AI teammates will appear here once the business is set up." />
        ) : (
          <div>
            {digitalEmployees.map((employee) => (
              <DigitalEmployeeCard
                key={String(employee.employeeId ?? employee.id)}
                employee={employee}
                businessId={businessId}
              />
            ))}
          </div>
        )}
      </ShellPanel>
        </>
      ) : null}

      {showInvite && businessId ? (
        <InvitePersonDialog
          businessId={businessId}
          showDevInviteLinks={showDevInviteLinks}
          onClose={() => setShowInvite(false)}
          onSent={() => {
            setShowInvite(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
