"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  VtHero,
  VtPage,
  VtPanel,
  VtStatusChip,
} from "@/components/product/VtChrome";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export type CrmContactDetailModel = {
  contact: {
    id: string;
    partyId?: string;
    name: string;
    email?: string;
    phone?: string;
    kind?: string;
    tags?: string[];
    notes?: string;
    ownerUserId?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  cards: Array<{
    id: string;
    title: string;
    stageId: string;
    stageLabel?: string;
    pipelineId: string;
    pipelineName?: string;
    value?: number;
  }>;
};

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div
        style={{
          fontSize: "0.65rem",
          color: cockpitColors.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          color: cockpitColors.textPrimary,
          fontSize: typography.body.fontSize,
          lineHeight: 1.5,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function CrmContactDetail({
  businessId,
  model,
}: {
  businessId: string;
  model: CrmContactDetailModel;
}) {
  const { contact, cards } = model;
  const peopleHref = `/b/${encodeURIComponent(businessId)}/people`;
  const pipelinesHref = `/b/${encodeURIComponent(businessId)}/pipelines`;

  return (
    <VtPage>
      <div style={{ marginBottom: spacing.md }}>
        <Link
          href={peopleHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: cockpitColors.textMuted,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 650,
          }}
        >
          <ArrowLeft size={14} /> People
        </Link>
      </div>

      <VtHero
        eyebrow="CRM contact"
        title={contact.name}
        right={<VtStatusChip label={String(contact.kind || "lead").toUpperCase()} tone="live" />}
      />

      <div
        style={{
          display: "grid",
          gap: spacing.md,
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
        }}
      >
        <VtPanel title="Profile">
          <div style={{ display: "grid", gap: spacing.md, padding: spacing.md }}>
            <Field label="Email" value={String(contact.email ?? "")} />
            <Field label="Phone" value={String(contact.phone ?? "")} />
            <Field label="Notes" value={String(contact.notes ?? "")} />
            <Field
              label="Tags"
              value={(contact.tags ?? []).join(", ")}
            />
            <Field label="Contact ID" value={contact.id} />
          </div>
        </VtPanel>

        <VtPanel
          title="Pipeline"
          right={
            <Link
              href={pipelinesHref}
              style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.accent }}
            >
              Open pipelines
            </Link>
          }
        >
          <div style={{ display: "grid", gap: 10, padding: spacing.md }}>
            {cards.length === 0 ? (
              <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: 13 }}>
                No pipeline cards linked yet.
              </p>
            ) : (
              cards.map((card) => (
                <Link
                  key={card.id}
                  href={pipelinesHref}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 750, color: cockpitColors.textPrimary }}>
                    {card.title}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: cockpitColors.textMuted }}>
                    {card.pipelineName || "Pipeline"}
                    {card.stageLabel ? ` · ${card.stageLabel}` : ""}
                  </div>
                </Link>
              ))
            )}
          </div>
        </VtPanel>
      </div>
    </VtPage>
  );
}
