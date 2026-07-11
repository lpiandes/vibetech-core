"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronRight } from "lucide-react";

import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import ShellPanel from "@/components/shell/ShellPanel";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { deriveSetupStatusSummary, incompleteSetupItems, settingsHubLinks, type SetupChecklistItem } from "./settingsSemantics";
import AccessRequestsPanel from "./AccessRequestsPanel";

function HubLinkRow({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{title}</div>
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>{description}</div>
      </div>
      <ChevronRight size={16} color={cockpitColors.textMuted} />
    </Link>
  );
}

export default function SettingsScreen({
  businessName,
  businessId,
  userName,
  userEmail,
  roleLabel,
  canManageTeam,
  canManageIntegrations,
  canManageKnowledge,
  setupChecklist = [],
  checklistComplete = false,
}: {
  businessName: string;
  businessId: string;
  userName: string;
  userEmail: string;
  roleLabel: string;
  canManageTeam: boolean;
  canManageIntegrations: boolean;
  canManageKnowledge: boolean;
  setupChecklist?: SetupChecklistItem[];
  checklistComplete?: boolean;
}) {
  const setupSummary = deriveSetupStatusSummary(setupChecklist);
  const incomplete = incompleteSetupItems(setupChecklist);
  const hubLinks = settingsHubLinks({ businessId, canManageTeam, canManageIntegrations, canManageKnowledge });

  const metricStrip = [
    { id: "setup", label: "Setup items", value: String(setupSummary.total) },
    { id: "complete", label: "Complete", value: String(setupSummary.complete) },
    { id: "remaining", label: "Remaining", value: String(setupSummary.incomplete) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <PageHeader title="Settings" description="Business access, setup, and configuration." />

      <ShellMetricStrip metrics={metricStrip} />

      <ShellPanel title="Business">
        <div style={{ padding: spacing.md }}>
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>Business name</div>
          <div style={{ fontWeight: 650, color: cockpitColors.textPrimary, marginTop: 4 }}>{businessName}</div>
        </div>
      </ShellPanel>

      <ShellPanel title="Access & roles">
        <div style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
          <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{userName}</div>
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>{userEmail}</div>
          <div style={{ marginTop: spacing.sm }}>
            <StatusBadge label={roleLabel} tone="neutral" />
          </div>
        </div>
        {hubLinks.length > 0 ? (
          <div>
            {hubLinks.map((link) => (
              <HubLinkRow key={link.id} title={link.title} description={link.description} href={link.href} />
            ))}
          </div>
        ) : null}
      </ShellPanel>

      <ShellPanel
        title="Setup status"
        subtitle={checklistComplete ? "All setup items complete" : `${setupSummary.incomplete} item${setupSummary.incomplete === 1 ? "" : "s"} remaining`}
      >
        {setupChecklist.length === 0 ? (
          <div style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
            Setup checklist will appear as your business package activates.
          </div>
        ) : (
          <div>
            {setupChecklist.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{item.title}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                  <StatusBadge label={item.complete ? "Complete" : "Needs setup"} tone={item.complete ? "success" : "warning"} />
                  {!item.complete && item.href ? (
                    <PrimaryButton href={item.href}>{item.actionLabel ?? "Open"}</PrimaryButton>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        {!checklistComplete && incomplete.length > 0 ? (
          <div style={{ padding: spacing.md, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
            Finish remaining setup so your Digital Employees can operate with full context.
          </div>
        ) : null}
      </ShellPanel>

      <ShellPanel title="Access requests">
        <div style={{ padding: spacing.md }}>
          <AccessRequestsPanel />
        </div>
      </ShellPanel>

      <ShellPanel title="Support & account">
        <div style={{ padding: spacing.md, display: "flex", justifyContent: "flex-end" }}>
          <PrimaryButton onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</PrimaryButton>
        </div>
      </ShellPanel>
    </div>
  );
}
