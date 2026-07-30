"use client";

import { cockpitColors } from "@/design/tokens";

export type SmsProvisioningStage = "provisioning" | "pending_carrier" | "ready";

/** Derive the white-glove Twilio provisioning stage from provision/prove state. */
export function resolveSmsProvisioningStage({
  loading = false,
  fromNumber = null,
  a2pRegistrationStatus = null,
}: {
  loading?: boolean;
  fromNumber?: string | null;
  a2pRegistrationStatus?: string | null;
}): SmsProvisioningStage {
  if (loading && !fromNumber) return "provisioning";
  if (!fromNumber) return "provisioning";
  if (String(a2pRegistrationStatus ?? "").toLowerCase() === "approved") return "ready";
  return "pending_carrier";
}

const STEPS: { stage: SmsProvisioningStage; label: string }[] = [
  { stage: "provisioning", label: "Provisioning number" },
  { stage: "pending_carrier", label: "Carrier approval pending" },
  { stage: "ready", label: "Ready to text" },
];

/**
 * Small step indicator for the white-glove Twilio flow: VIBETech buys the
 * number, then carriers approve A2P registration in the background.
 */
export default function SmsProvisioningStatus({
  stage,
  fromNumber = null,
  inboundWebhookConfigured = null,
}: {
  stage: SmsProvisioningStage;
  fromNumber?: string | null;
  inboundWebhookConfigured?: boolean | null;
}) {
  const activeIndex = STEPS.findIndex((s) => s.stage === stage);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {STEPS.map((step, index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          return (
            <div key={step.stage} style={{ display: "flex", alignItems: "center", gap: 6, flex: index < STEPS.length - 1 ? 1 : undefined }}>
              <div
                title={step.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                  color: done || current ? "#ffffff" : cockpitColors.textMuted,
                  background: done ? "#047857" : current ? cockpitColors.accent : cockpitColors.panelElevated,
                  border: `1px solid ${done ? "#047857" : current ? cockpitColors.accent : cockpitColors.panelBorder}`,
                }}
              >
                {done ? "✓" : index + 1}
              </div>
              {index < STEPS.length - 1 ? (
                <div style={{ flex: 1, height: 2, background: done ? "#047857" : cockpitColors.panelBorder, minWidth: 16 }} />
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 650, color: cockpitColors.textMuted }}>
        {STEPS.map((step) => (
          <span key={step.stage} style={{ color: step.stage === stage ? cockpitColors.textPrimary : cockpitColors.textMuted }}>
            {step.label}
          </span>
        ))}
      </div>
      {stage === "pending_carrier" ? (
        <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
          {fromNumber ? `${fromNumber} is live for testing.` : "Number is live for testing."} US carrier brand/campaign
          registration can take a few days — VIBETech tracks it automatically; no action needed.
        </p>
      ) : null}
      {stage === "ready" ? (
        <p style={{ margin: 0, fontSize: 12, color: "#047857", fontWeight: 650, lineHeight: 1.45 }}>
          Carrier approved. Texting is fully live for {fromNumber ?? "this number"}.
        </p>
      ) : null}
      {inboundWebhookConfigured === false ? (
        <p style={{ margin: 0, fontSize: 11, color: "#b45309", lineHeight: 1.4 }}>
          Couldn’t confirm the inbound texting webhook automatically — replies may not reach the appointment setter yet.
        </p>
      ) : null}
    </div>
  );
}
