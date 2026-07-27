"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronRight } from "lucide-react";

import PrimaryButton from "@/components/product/PrimaryButton";
import { cockpitColors, spacing } from "@/design/tokens";
import { settingsHubLinks, type SetupChecklistItem } from "./settingsSemantics";
import AccessRequestsPanel from "./AccessRequestsPanel";
import BillingUsagePanel from "./BillingUsagePanel";

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
  const hubLinks = settingsHubLinks({ businessId, canManageTeam, canManageIntegrations, canManageKnowledge });

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
                background: "#fff",
                border: "1px solid rgba(15,23,42,.08)",
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
            background: "#fff",
            border: "1px solid rgba(15,23,42,.08)",
          }}
        >
          <AccessRequestsPanel />
        </div>
      </section>

      <div
        style={{
          padding: 16,
          borderRadius: 16,
          background: "#fff",
          border: "1px solid rgba(15,23,42,.08)",
        }}
      >
        <BillingUsagePanel businessId={businessId} purchasedPackages={purchasedPackages} />
      </div>

      <PrimaryButton onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</PrimaryButton>
    </div>
  );
}
