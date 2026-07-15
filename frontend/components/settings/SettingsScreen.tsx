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
      <PageHeader title="Settings" description="Clear controls where safe — Ask VIBETech for complex configuration." />

      <ShellPanel title="Ask VIBETech to change this">
        <div style={{ padding: spacing.md }}>
          <p style={{ margin: `0 0 ${spacing.sm}`, color: cockpitColors.textSecondary, fontSize: typography.body.fontSize }}>
            Prefer governed changes for roles, workflows, and operating behavior.
          </p>
          <Link
            href={`/b/${encodeURIComponent(businessId)}/architect`}
            style={{
              color: cockpitColors.accent,
              fontWeight: 600,
              fontSize: typography.button.fontSize,
              textDecoration: "none",
            }}
          >
            Ask VIBETech
          </Link>
        </div>
      </ShellPanel>

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
        title="Your steps to make your business prosper"
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
                  display: "grid",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{item.title}</div>
                    {"whereInApp" in item && item.whereInApp ? (
                      <div style={{ marginTop: 2, fontSize: 12, color: cockpitColors.accent, fontWeight: 650 }}>
                        In VIBETech: {String(item.whereInApp)}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                    <StatusBadge label={item.complete ? "Complete" : "Needs setup"} tone={item.complete ? "success" : "warning"} />
                    {!item.complete && item.href ? (
                      <PrimaryButton href={item.href}>{item.actionLabel ?? "Open"}</PrimaryButton>
                    ) : null}
                  </div>
                </div>
                {!item.complete && "summary" in item && item.summary ? (
                  <div style={{ fontSize: 13, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>{String(item.summary)}</div>
                ) : null}
                {!item.complete && "inApp" in item && Array.isArray(item.inApp) && item.inApp.length ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
                      In the app
                    </div>
                    <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: cockpitColors.textPrimary }}>
                      {item.inApp.map((line: string) => <li key={line}>{line}</li>)}
                    </ol>
                  </div>
                ) : null}
                {!item.complete && "external" in item && Array.isArray(item.external) && item.external.length ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
                      On the external platform
                    </div>
                    <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: cockpitColors.textPrimary }}>
                      {item.external.map((line: string) => <li key={line}>{line}</li>)}
                    </ol>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {!checklistComplete && incomplete.length > 0 ? (
          <div style={{ padding: spacing.md, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
            Finish remaining steps so your AI teammates can operate with full context.
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
