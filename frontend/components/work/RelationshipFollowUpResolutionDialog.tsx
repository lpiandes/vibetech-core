"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors, spacing, typography } from "@/design/tokens";

import {
  allowedRelationshipFollowUpOutcomes,
  outcomeAllowsQualificationUpdates,
  outcomeRequiresNextFollowUpAt,
  type RelationshipFollowUpOutcome,
  type RelationshipFollowUpWorkLike,
} from "./relationshipFollowUpResolutionSemantics";

function inputStyle() {
  return {
    width: "100%",
    border: `1px solid ${cockpitColors.panelBorder}`,
    borderRadius: 8,
    padding: "9px 10px",
    fontSize: typography.caption.fontSize,
    color: cockpitColors.textPrimary,
    backgroundColor: cockpitColors.panel,
  };
}

export default function RelationshipFollowUpResolutionDialog({
  businessId,
  work,
  outcomes,
  onClose,
}: {
  businessId: string;
  work: RelationshipFollowUpWorkLike;
  outcomes: RelationshipFollowUpOutcome[];
  onClose: () => void;
}) {
  const router = useRouter();
  const allowed = useMemo(
    () => allowedRelationshipFollowUpOutcomes({
      outcomes,
      relationshipType: work.metadata?.relationshipFollowUp?.relationshipType,
    }),
    [outcomes, work.metadata?.relationshipFollowUp?.relationshipType],
  );
  const [outcomeId, setOutcomeId] = useState(allowed[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [qualificationText, setQualificationText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = allowed.find((outcome) => outcome.id === outcomeId) ?? null;

  async function submit() {
    if (!work.id) return;
    setPending(true);
    setError(null);
    try {
      let qualificationUpdates: Record<string, unknown> | undefined;
      if (outcomeAllowsQualificationUpdates(selected) && qualificationText.trim()) {
        try {
          qualificationUpdates = JSON.parse(qualificationText);
        } catch {
          setError("Qualification updates must be valid JSON.");
          setPending(false);
          return;
        }
      }
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/relationship-followups/work/${encodeURIComponent(work.id)}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outcomeId,
            note,
            nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : undefined,
            qualificationUpdates,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "Could not resolve follow-up."));
      router.refresh();
      onClose();
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setPending(false);
    }
  }

  return (
    <SimpleModal
      title="Resolve follow-up"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={pending ? undefined : onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={pending ? undefined : submit}>{pending ? "Saving..." : "Save outcome"}</PrimaryButton>
        </>
      }
    >
      <div style={{ display: "grid", gap: spacing.md }}>
        <label style={{ display: "grid", gap: 6, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
          Outcome
          <select value={outcomeId} onChange={(event) => setOutcomeId(event.target.value)} style={inputStyle()}>
            {allowed.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.displayName ?? outcome.id}
              </option>
            ))}
          </select>
        </label>

        {outcomeRequiresNextFollowUpAt(selected) ? (
          <label style={{ display: "grid", gap: 6, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
            Next follow-up
            <input type="datetime-local" value={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} style={inputStyle()} />
          </label>
        ) : null}

        {outcomeAllowsQualificationUpdates(selected) ? (
          <label style={{ display: "grid", gap: 6, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
            Qualification updates
            <textarea
              value={qualificationText}
              onChange={(event) => setQualificationText(event.target.value)}
              placeholder='{"intent":"buy","decisionTimeline":"0_3_months"}'
              rows={3}
              style={{ ...inputStyle(), resize: "vertical" }}
            />
          </label>
        ) : null}

        <label style={{ display: "grid", gap: 6, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
          Note
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} style={{ ...inputStyle(), resize: "vertical" }} />
        </label>

        {error ? <div style={{ color: "#b91c1c", fontSize: typography.caption.fontSize }}>{error}</div> : null}
      </div>
    </SimpleModal>
  );
}
