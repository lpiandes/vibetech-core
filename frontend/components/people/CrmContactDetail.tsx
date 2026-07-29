"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import {
  VtHero,
  VtPage,
  VtPanel,
  VtStatusChip,
  vtInputStyle,
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

const KINDS = ["lead", "client", "family", "contractor", "vendor", "other"];

export default function CrmContactDetail({
  businessId,
  model,
}: {
  businessId: string;
  model: CrmContactDetailModel;
}) {
  const router = useRouter();
  const { contact, cards } = model;
  const peopleHref = `/b/${encodeURIComponent(businessId)}/people`;
  const pipelinesHref = `/b/${encodeURIComponent(businessId)}/pipelines`;

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(contact.name || "");
  const [email, setEmail] = useState(contact.email || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [kind, setKind] = useState(contact.kind || "lead");
  const [notes, setNotes] = useState(contact.notes || "");
  const [tags, setTags] = useState((contact.tags ?? []).join(", "));

  const isAiProspect = (contact.tags ?? []).some((t) => String(t) === "ai_prospect");
  const prospectingNotes = isAiProspect ? String(contact.notes ?? "") : "";
  const sourceLines = prospectingNotes
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^Sources:/i.test(l) || /^Website:/i.test(l) || /^Overview:/i.test(l) || /^Email:/i.test(l) || /^Phone:/i.test(l) || /^Size:/i.test(l) || /^Company:/i.test(l));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/contacts`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: contact.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          kind,
          notes,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not save contact");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

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
        title={editing ? name || contact.name : contact.name}
        right={<VtStatusChip label={String(kind || "lead").toUpperCase()} tone="live" />}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {editing ? (
            <>
              <PrimaryButton onClick={() => void save()} disabled={busy || !name.trim()}>
                {busy ? "Saving…" : "Save"}
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  setEditing(false);
                  setName(contact.name || "");
                  setEmail(contact.email || "");
                  setPhone(contact.phone || "");
                  setKind(contact.kind || "lead");
                  setNotes(contact.notes || "");
                  setTags((contact.tags ?? []).join(", "));
                  setError(null);
                }}
              >
                Cancel
              </SecondaryButton>
            </>
          ) : (
            <PrimaryButton onClick={() => setEditing(true)}>Edit</PrimaryButton>
          )}
        </div>
      </VtHero>

      {error ? <p style={{ color: cockpitColors.critical, fontWeight: 800 }}>{error}</p> : null}

      <div
        style={{
          display: "grid",
          gap: spacing.md,
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
        }}
      >
        <VtPanel title="Profile">
          <div style={{ display: "grid", gap: spacing.md, padding: spacing.md }}>
            {editing ? (
              <>
                <label style={labelStyle}>
                  Name
                  <input value={name} onChange={(e) => setName(e.target.value)} style={vtInputStyle} />
                </label>
                <label style={labelStyle}>
                  Email
                  <input value={email} onChange={(e) => setEmail(e.target.value)} style={vtInputStyle} />
                </label>
                <label style={labelStyle}>
                  Phone
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} style={vtInputStyle} />
                </label>
                <label style={labelStyle}>
                  Type
                  <select value={kind} onChange={(e) => setKind(e.target.value)} style={vtInputStyle}>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  Tags
                  <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma-separated" style={vtInputStyle} />
                </label>
                <label style={labelStyle}>
                  Notes
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={vtInputStyle} />
                </label>
              </>
            ) : (
              <>
                <Field label="Email" value={String(contact.email ?? "")} />
                <Field label="Phone" value={String(contact.phone ?? "")} />
                <Field label="Notes" value={String(contact.notes ?? "")} />
                <Field label="Tags" value={(contact.tags ?? []).join(", ")} />
                <Field label="Contact ID" value={contact.id} />
                {isAiProspect ? (
                  <div style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    background: "#f8fafc",
                    display: "grid",
                    gap: 6,
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>AI Prospecting sources</div>
                    {sourceLines.length ? sourceLines.map((line) => (
                      <div key={line} style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.textSecondary, wordBreak: "break-word" }}>
                        {line}
                      </div>
                    )) : (
                      <div style={{ fontSize: 12, color: cockpitColors.textMuted, fontWeight: 650 }}>
                        Tagged ai_prospect — see notes for research trail.
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </VtPanel>

        <VtPanel title="Pipeline cards">
          <div style={{ display: "grid", gap: spacing.sm, padding: spacing.md }}>
            {cards.length === 0 ? (
              <p style={{ margin: 0, color: cockpitColors.textMuted, fontWeight: 650 }}>
                No pipeline cards yet.{" "}
                <Link href={pipelinesHref} style={{ color: cockpitColors.accent, fontWeight: 800 }}>
                  Open Pipelines
                </Link>
              </p>
            ) : (
              cards.map((card) => (
                <Link
                  key={card.id}
                  href={pipelinesHref}
                  style={{
                    display: "block",
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    textDecoration: "none",
                    color: cockpitColors.textPrimary,
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{card.title}</div>
                  <div style={{ fontSize: 12, color: cockpitColors.textSecondary, marginTop: 4, fontWeight: 650 }}>
                    {card.pipelineName || "Pipeline"} · {card.stageLabel || card.stageId}
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
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 800,
  color: cockpitColors.textMuted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};
