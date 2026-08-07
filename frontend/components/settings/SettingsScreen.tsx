"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronRight } from "lucide-react";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors, spacing } from "@/design/tokens";
import { settingsHubLinks, type SetupChecklistItem } from "./settingsSemantics";
import AccessRequestsPanel from "./AccessRequestsPanel";
import BillingUsagePanel from "./BillingUsagePanel";
import SalesAnalyticsPanel from "./SalesAnalyticsPanel";
import ExecutiveDashboardPanel from "./ExecutiveDashboardPanel";
import { businessGrantsSocialCheckerAccess } from "../../../backend/core/platform/packages/socialCheckerEntitlement.js";

/**
 * Settings = who you are + a few doors. Setup lives on Home.
 */
export default function SettingsScreen({
  businessName,
  businessId,
  userName,
  userEmail,
  roleLabel,
  canManageTeam,
  canManageIntegrations,
  canManageKnowledge,
  purchasedPackages = [],
}: {
  businessName: string;
  businessId: string;
  userName: string;
  userEmail: string;
  roleLabel: string;
  canManageTeam: boolean;
  canManageIntegrations: boolean;
  canManageKnowledge: boolean;
  purchasedPackages?: string[];
  setupChecklist?: SetupChecklistItem[];
  checklistComplete?: boolean;
}) {
  const router = useRouter();
  const [restartingTour, setRestartingTour] = useState(false);
  const [resettingLaunch, setResettingLaunch] = useState(false);
  const hubLinks = settingsHubLinks({ businessId, canManageTeam, canManageIntegrations, canManageKnowledge });
  const hasSocial = businessGrantsSocialCheckerAccess(purchasedPackages);
  const hasSalesAnalytics = purchasedPackages.some((id) => ["sales_analytics", "reporting_automation"].includes(String(id)));
  const hasExecutiveDashboard = purchasedPackages.some((id) => String(id) === "addon_executive_dashboard");
  const canResetLaunch = canManageIntegrations
    || /owner|admin/i.test(String(roleLabel ?? ""));

  async function restartTutorial() {
    setRestartingTour(true);
    try {
      await fetch(`/api/businesses/${encodeURIComponent(businessId)}/onboarding/tour`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepIndex: 0,
          completedAt: null,
          restartedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
      try {
        for (const v of [1, 2, 3]) {
          window.localStorage.removeItem(`vt.productTour.${v}.${businessId}.me`);
        }
      } catch {
        /* ignore */
      }
      router.push(`/b/${encodeURIComponent(businessId)}/home?tour=1`);
    } finally {
      setRestartingTour(false);
    }
  }

  async function resetLaunchPath() {
    if (!window.confirm("Reset launch path for this business? Email/calendar will disconnect so you can re-film from Connect business email.")) {
      return;
    }
    setResettingLaunch(true);
    try {
      window.location.assign(`/api/businesses/${encodeURIComponent(businessId)}/launch/reset`);
    } finally {
      setResettingLaunch(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 28, maxWidth: 480, paddingBottom: spacing.xl }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", color: cockpitColors.textPrimary }}>
          Settings
        </h1>
      </div>

      <section style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.textMuted }}>Business</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: cockpitColors.textPrimary }}>{businessName}</div>
      </section>

      <section style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.textMuted }}>You</div>
        <div style={{ fontSize: 18, fontWeight: 750, color: cockpitColors.textPrimary }}>{userName}</div>
        <div style={{ fontSize: 14, color: cockpitColors.textSecondary }}>{userEmail}</div>
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: cockpitColors.accent }}>{roleLabel}</div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.textMuted }}>Tutorial</div>
        <SecondaryButton onClick={() => void restartTutorial()}>
          {restartingTour ? "Opening…" : "See tutorial again"}
        </SecondaryButton>
        {canResetLaunch ? (
          <SecondaryButton onClick={() => void resetLaunchPath()}>
            {resettingLaunch ? "Resetting…" : "Reset launch path (demo)"}
          </SecondaryButton>
        ) : null}
        {hasSocial ? (
          <a
            href="https://social.vtechdevelopment.com/"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px",
              borderRadius: 16,
              background: cockpitColors.panel,
              border: `1px solid ${cockpitColors.panelBorder}`,
              textDecoration: "none",
              color: cockpitColors.textPrimary,
              fontWeight: 750,
              fontSize: 17,
            }}
          >
            Open Social Checker
            <ChevronRight size={20} color={cockpitColors.textMuted} />
          </a>
        ) : null}
      </section>

      {hubLinks.length ? (
        <section style={{ display: "grid", gap: 8 }}>
          {hubLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 18px",
                borderRadius: 16,
                background: cockpitColors.panel,
                border: `1px solid ${cockpitColors.panelBorder}`,
                textDecoration: "none",
                color: cockpitColors.textPrimary,
                fontWeight: 750,
                fontSize: 17,
              }}
            >
              {link.title}
              <ChevronRight size={20} color={cockpitColors.textMuted} />
            </Link>
          ))}
        </section>
      ) : null}

      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.textMuted }}>Access asks</div>
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: cockpitColors.panel,
            border: `1px solid ${cockpitColors.panelBorder}`,
          }}
        >
          <AccessRequestsPanel />
        </div>
      </section>

      <div
        style={{
          padding: 16,
          borderRadius: 16,
          background: cockpitColors.panel,
          border: `1px solid ${cockpitColors.panelBorder}`,
        }}
      >
        <BillingUsagePanel businessId={businessId} purchasedPackages={purchasedPackages} />
      </div>

      {hasExecutiveDashboard ? (
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: cockpitColors.panel,
            border: `1px solid ${cockpitColors.panelBorder}`,
          }}
        >
          <ExecutiveDashboardPanel businessId={businessId} />
        </div>
      ) : hasSalesAnalytics ? (
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: cockpitColors.panel,
            border: `1px solid ${cockpitColors.panelBorder}`,
          }}
        >
          <SalesAnalyticsPanel businessId={businessId} />
        </div>
      ) : null}

      <PrimaryButton onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</PrimaryButton>
    </div>
  );
}
