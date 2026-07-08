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
import { copyInviteLink } from "@/lib/platform/inviteLinks";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  deriveTeamCounts,
  employeeStatusTone,
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
  const tone = employeeStatusTone(employee);

  return (
    <div
      style={{
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.md }}>
        <EntityAvatar name={String(employee.name ?? "Digital employee")} kind="employee" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{employee.name}</div>
            <StatusBadge label={statusLabel} tone={tone} />
          </div>
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, marginTop: 2 }}>
            {employee.responsibility ?? employee.role}
          </div>
          {employee.description ? (
            <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 6, lineHeight: 1.45 }}>
              {employee.description}
            </div>
          ) : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            style={{
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: radius.medium,
              backgroundColor: cockpitColors.accent,
              color: "#fff",
              fontSize: typography.caption.fontSize,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {action.label}
          </Link>
        ) : null}
      </div>

      {employee.currentHandling ? (
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
          Currently handling: <span style={{ color: cockpitColors.textPrimary }}>{employee.currentHandling}</span>
        </div>
      ) : null}

      {monitoring.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
          {monitoring.map((item) => (
            <span
              key={item.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px",
                borderRadius: radius.pill,
                backgroundColor: cockpitColors.panelElevated,
                border: `1px solid ${cockpitColors.panelBorder}`,
                fontSize: "0.7rem",
                color: cockpitColors.textSecondary,
              }}
            >
              {item.label}
              <strong style={{ color: cockpitColors.textPrimary }}>{item.count}</strong>
            </span>
          ))}
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div
          style={{
            padding: spacing.sm,
            borderRadius: radius.medium,
            backgroundColor: "rgba(234,179,8,0.08)",
            border: "1px solid rgba(234,179,8,0.2)",
          }}
        >
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: cockpitColors.textSecondary, marginBottom: 4 }}>
            Setup needed
          </div>
          <ul style={{ margin: 0, paddingLeft: spacing.md, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!action && businessId && monitoring.length === 0 && blockers.length === 0 ? (
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
          Monitoring your business and ready when work arrives.
        </div>
      ) : null}
    </div>
  );
}

export default function TeamExecutiveLayout({ platformTeam }: { platformTeam?: PlatformTeamData }) {
  const viewModel = useContext<TeamViewModel | null>(TeamViewModelContext);
  const [showInvite, setShowInvite] = useState(false);
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
      { id: "human", label: "Human team", value: String(counts.humanTeam) },
      { id: "digital", label: "Digital employees", value: String(counts.digitalEmployees) },
      { id: "ready", label: "Ready", value: String(counts.ready) },
      { id: "setup", label: "Needs setup", value: String(counts.needsSetup) },
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

  const inviteAction = canInvite ? <PrimaryButton onClick={() => setShowInvite(true)}>+ Invite person</PrimaryButton> : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <PageHeader
        title="Team"
        description="People and Digital Employees working in this business."
        action={inviteAction}
      />

      {copyMessage ? (
        <p style={{ ...typography.caption, color: cockpitColors.accent, margin: 0 }}>{copyMessage}</p>
      ) : null}

      <ShellMetricStrip metrics={metricStrip} />

      <ShellPanel
        title="Human team"
        subtitle={`${counts.humanTeam} member${counts.humanTeam === 1 ? "" : "s"}`}
        action={platformMembers.length === 0 ? inviteAction : undefined}
      >
        {platformMembers.length === 0 ? (
          <PanelEmpty description="Invite employees so they can access VIBETech and work with your digital employees." />
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
        title="Digital workforce"
        subtitle={`${counts.digitalEmployees} digital employee${counts.digitalEmployees === 1 ? "" : "s"}`}
      >
        {digitalEmployees.length === 0 ? (
          <PanelEmpty description="Your digital employees will appear here once your business package is active." />
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
