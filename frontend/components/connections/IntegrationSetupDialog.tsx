"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import type { IntegrationDisplay } from "./integrationDisplay";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";

export default function IntegrationSetupDialog({
  integration,
  hasRealConnect = false,
  onClose,
}: {
  integration: IntegrationDisplay;
  hasRealConnect?: boolean;
  onClose: () => void;
}) {
  const Icon = integration.icon;
  const router = useRouter();
  const { businessId } = useBusinessScope();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBusinessEmail = integration.id === "business_email" && hasRealConnect;

  async function connectEmail() {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/integrations/business-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Could not connect email."));
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SimpleModal
      title={`Connect ${integration.title}`}
      onClose={onClose}
      footer={
        isBusinessEmail ? (
          <>
            <SecondaryButton onClick={loading ? undefined : onClose}>Cancel</SecondaryButton>
            <PrimaryButton onClick={loading ? undefined : connectEmail}>{loading ? "Connecting…" : "Connect for development"}</PrimaryButton>
          </>
        ) : (
          <PrimaryButton onClick={onClose}>Got it</PrimaryButton>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: cockpitColors.accentMuted,
              color: cockpitColors.accent,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={20} />
          </span>
          <p style={{ ...typography.body, color: cockpitColors.textSecondary, margin: 0, lineHeight: 1.45 }}>{integration.description}</p>
        </div>

        <div
          style={{
            padding: spacing.md,
            borderRadius: 8,
            backgroundColor: cockpitColors.panelElevated,
            border: `1px solid ${cockpitColors.panelBorder}`,
          }}
        >
          {isBusinessEmail ? (
            <>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                Development email connection
              </div>
              <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: `${spacing.xs} 0 0`, lineHeight: 1.5 }}>
                Connects a development email provider so your Digital Employees can send prospect acknowledgments and
                follow-up messages. Production Gmail setup uses the same connection architecture.
              </p>
              {error ? (
                <p style={{ color: "#b91c1c", margin: `${spacing.sm} 0 0`, fontSize: typography.caption.fontSize }}>{error}</p>
              ) : null}
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
                We&apos;ll set this up with you
              </div>
              <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: `${spacing.xs} 0 0`, lineHeight: 1.5 }}>
                Connecting {integration.title.toLowerCase()} is part of your onboarding. Our team will walk you through setup and
                confirm everything is working before it goes live.
              </p>
            </>
          )}
        </div>
      </div>
    </SimpleModal>
  );
}
