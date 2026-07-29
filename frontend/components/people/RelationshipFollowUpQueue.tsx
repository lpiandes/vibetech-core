"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BriefcaseBusiness, ChevronDown, RefreshCw } from "lucide-react";

import StatusBadge from "@/components/product/StatusBadge";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, radius, spacing, typography } from "@/design/tokens";

import {
  contactabilityLabel,
  contactabilityTone,
  latestActivityLabel,
  sortRelationshipFollowUps,
  type RelationshipFollowUpCandidate,
} from "./relationshipFollowUpSemantics";

function ContactChip({ label, tone }: { label: string; tone: "success" | "warning" }) {
  return <StatusBadge label={label} tone={tone} />;
}

function EvidenceDetails({ candidate }: { candidate: RelationshipFollowUpCandidate }) {
  const evidence = candidate.evidence ?? {};
  const qualification = (evidence.qualification ?? {}) as Record<string, unknown>;
  const importedNotes = Array.isArray(evidence.importedNotes) ? evidence.importedNotes : [];
  const propertyInterest = evidence.propertyInterest as { value?: unknown; source?: string } | null;

  return (
    <details style={{ marginTop: spacing.sm }}>
      <summary
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: cockpitColors.textSecondary,
          fontSize: typography.caption.fontSize,
          cursor: "pointer",
        }}
      >
        <ChevronDown size={14} aria-hidden />
        Evidence
      </summary>
      <div
        style={{
          marginTop: spacing.xs,
          display: "grid",
          gap: 4,
          color: cockpitColors.textMuted,
          fontSize: typography.caption.fontSize,
          lineHeight: 1.45,
        }}
      >
        {qualification.decisionTimeline ? <span>Decision timeline: {String(qualification.decisionTimeline)}</span> : null}
        {qualification.intent ? <span>Intent: {String(qualification.intent)}</span> : null}
        {propertyInterest?.value ? <span>Linked interest: {String(propertyInterest.value)}</span> : null}
        {importedNotes.length > 0 ? <span>Imported notes: {importedNotes.length} evidence-only record{importedNotes.length === 1 ? "" : "s"}</span> : null}
      </div>
    </details>
  );
}

function CandidateRow({ candidate, businessId }: { candidate: RelationshipFollowUpCandidate; businessId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workHref = `/b/${businessId}/work`;

  async function createWork() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/relationship-followups/${encodeURIComponent(candidate.candidateId)}/create-work`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(String(body?.error ?? "Follow-up work could not be created."));
      }
      router.refresh();
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      style={{
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
        display: "grid",
        gap: spacing.sm,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: spacing.xs, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ color: cockpitColors.textPrimary, fontSize: typography.body.fontSize }}>{candidate.displayName}</strong>
            <span style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>{candidate.relationshipLabel}</span>
            <StatusBadge label={candidate.priority} tone={candidate.priority === "high" ? "warning" : "info"} />
          </div>
          <div style={{ marginTop: 3, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
            {candidate.reasonLabel}
          </div>
          <div style={{ marginTop: 3, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
            {latestActivityLabel(candidate)}
          </div>
        </div>
        {candidate.existingOpenWorkId ? (
          <Link
            href={workHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
              padding: "7px 10px",
              color: cockpitColors.textPrimary,
              textDecoration: "none",
              fontSize: typography.caption.fontSize,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            <BriefcaseBusiness size={14} aria-hidden />
            Open work
          </Link>
        ) : (
          <button
            type="button"
            onClick={createWork}
            disabled={pending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.accent}`,
              padding: "7px 10px",
              backgroundColor: cockpitColors.accent,
              color: "#fff",
              fontSize: typography.caption.fontSize,
              fontWeight: 700,
              cursor: pending ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {pending ? <RefreshCw size={14} aria-hidden /> : <BriefcaseBusiness size={14} aria-hidden />}
            {pending ? "Creating" : "Create follow-up work"}
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
        <ContactChip label={`Email ${contactabilityLabel(candidate, "email")}`} tone={contactabilityTone(candidate, "email") as "success" | "warning"} />
        <ContactChip label={`SMS ${contactabilityLabel(candidate, "sms")}`} tone={contactabilityTone(candidate, "sms") as "success" | "warning"} />
      </div>
      <EvidenceDetails candidate={candidate} />
      {error ? <div style={{ color: "#b91c1c", fontSize: typography.caption.fontSize }}>{error}</div> : null}
    </div>
  );
}

export default function RelationshipFollowUpQueue({
  candidates,
  businessId,
}: {
  candidates?: RelationshipFollowUpCandidate[];
  businessId: string;
}) {
  const sorted = useMemo(() => sortRelationshipFollowUps(candidates ?? []), [candidates]);
  if (sorted.length === 0) return null;

  return (
    <ShellPanel
      title="Relationship follow-ups"
      subtitle={`${sorted.length} candidate${sorted.length === 1 ? "" : "s"} needing attention`}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {sorted.map((candidate) => (
          <CandidateRow key={candidate.candidateId} candidate={candidate} businessId={businessId} />
        ))}
      </div>
    </ShellPanel>
  );
}
