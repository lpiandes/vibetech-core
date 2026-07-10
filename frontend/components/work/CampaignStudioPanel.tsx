"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  resolveCampaignApprovalPresentation,
  resolveCampaignReview,
  type WorkQueueItem,
} from "./workQueueSemantics";

type SectionFields = {
  heading?: string | null;
  body?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  subjectId?: string | null;
};

type StudioSection = {
  id: string;
  type: string;
  order: number;
  fields: SectionFields;
};

type SectionType = {
  id: string;
  label: string;
  fields: string[];
  description?: string;
};

const FIELD_LABELS: Record<string, string> = {
  heading: "Heading",
  body: "Paragraph",
  ctaText: "CTA text",
  ctaUrl: "CTA destination",
  subjectId: "Property id",
};

function emptySection(type: string, order: number): StudioSection {
  return {
    id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    order,
    fields: { heading: "", body: "", ctaText: "", ctaUrl: "", subjectId: "" },
  };
}

export default function CampaignStudioPanel({
  item,
  businessId,
}: {
  item: WorkQueueItem;
  businessId: string;
}) {
  const router = useRouter();
  const review = resolveCampaignReview(item);
  const [subjectLine, setSubjectLine] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [sections, setSections] = useState<StudioSection[]>([]);
  const [sectionTypes, setSectionTypes] = useState<SectionType[]>([]);
  const [binding, setBinding] = useState<Record<string, unknown> | null>(null);
  const [knowledgeSources, setKnowledgeSources] = useState<Array<Record<string, unknown>>>([]);
  const [knowledgeSummary, setKnowledgeSummary] = useState("");
  const [sendPreview, setSendPreview] = useState<Record<string, unknown> | null>(null);
  const [previewPartyId, setPreviewPartyId] = useState("");
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [optimisticQueued, setOptimisticQueued] = useState(false);
  const [addType, setAddType] = useState("custom_text");

  const base = `/api/businesses/${encodeURIComponent(businessId)}/campaigns/work/${encodeURIComponent(String(item.id))}`;

  useEffect(() => {
    setOptimisticQueued(false);
    setError(null);
    setNotice(null);
    setPreviewBody(null);
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(base);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(data?.error ?? "Could not load campaign studio."));
        if (cancelled) return;
        const document = data.document ?? {};
        setSubjectLine(String(document.subjectLine ?? review?.draftSubject ?? ""));
        setPreviewText(String(document.previewText ?? ""));
        setSections(Array.isArray(document.sections) ? document.sections : []);
        setSectionTypes(Array.isArray(data.sectionTypes) ? data.sectionTypes : []);
        setBinding(data.expectedApprovalBinding ?? null);
        setKnowledgeSources(Array.isArray(data.campaign?.knowledgeSources) ? data.campaign.knowledgeSources : []);
        setKnowledgeSummary(String(data.campaign?.knowledgeSummary ?? review?.knowledgeSummary ?? ""));
        setTemplateName(String(data.campaign?.campaignName ?? review?.campaignName ?? "Saved campaign"));
        const firstParty = data.campaign?.recipientPreparations?.[0]?.partyId;
        if (firstParty) setPreviewPartyId(String(firstParty));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load campaign studio.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [base, item.id, review?.campaignName, review?.draftSubject]);

  const approval = resolveCampaignApprovalPresentation(item, { requestPending: busy, optimisticQueued });
  const recipients = review?.recipients ?? [];

  const typeOptions = useMemo(() => {
    if (sectionTypes.length) return sectionTypes;
    return [
      { id: "intro", label: "Introduction", fields: ["heading", "body"] },
      { id: "custom_text", label: "Custom text", fields: ["heading", "body"] },
      { id: "property_feature", label: "Property feature", fields: ["heading", "body", "subjectId"] },
      { id: "market_update", label: "Market update", fields: ["heading", "body"] },
      { id: "educational_content", label: "Educational content", fields: ["heading", "body"] },
      { id: "home_value_cma", label: "Home value / CMA", fields: ["heading", "body", "ctaText"] },
      { id: "referral_request", label: "Referral request", fields: ["heading", "body", "ctaText"] },
      { id: "call_to_action", label: "Call to action", fields: ["ctaText", "ctaUrl", "body"] },
      { id: "contact_signature", label: "Contact signature", fields: ["heading", "body"] },
    ];
  }, [sectionTypes]);

  function fieldsForType(type: string) {
    return typeOptions.find((entry) => entry.id === type)?.fields ?? ["heading", "body"];
  }

  function moveSection(index: number, direction: -1 | 1) {
    setSections((current) => {
      const next = [...current].sort((a, b) => a.order - b.order);
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const swap = next[index];
      next[index] = next[target];
      next[target] = swap;
      return next.map((section, order) => ({ ...section, order }));
    });
  }

  function updateSectionField(index: number, field: keyof SectionFields, value: string) {
    setSections((current) => current.map((section, i) => (
      i === index
        ? { ...section, fields: { ...section.fields, [field]: value } }
        : section
    )));
  }

  async function saveDraft() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${base}/document`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectLine,
          previewText: previewText || null,
          sections: sections.map((section, order) => ({
            ...section,
            order,
            fields: {
              heading: section.fields.heading || null,
              body: section.fields.body || null,
              ctaText: section.fields.ctaText || null,
              ctaUrl: section.fields.ctaUrl || null,
              subjectId: section.fields.subjectId || null,
            },
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not save draft."));
      setNotice(data.idempotent ? "Draft unchanged." : data.forkedFromApproved
        ? `Saved as new draft version ${data.contentVersion}. Prior approved version retained.`
        : `Saved draft version ${data.contentVersion}.`);
      const refreshed = await fetch(base);
      const refreshedData = await refreshed.json().catch(() => ({}));
      if (refreshed.ok) {
        setBinding(refreshedData.expectedApprovalBinding ?? null);
        setSections(Array.isArray(refreshedData.document?.sections) ? refreshedData.document.sections : sections);
        setSubjectLine(String(refreshedData.document?.subjectLine ?? subjectLine));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshAudience() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${base}/audience/refresh`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not refresh audience."));
      setNotice(data.fingerprintChanged
        ? "Audience refreshed. Prior approval no longer authorizes this version."
        : "Audience unchanged.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh audience.");
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${base}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId: previewPartyId || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not preview."));
      setPreviewBody(String(data.preview?.body ?? ""));
      if (data.preview?.subjectLine) setNotice(`Preview subject: ${data.preview.subjectLine}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAsTemplate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${base}/save-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName || review?.campaignName || "Saved campaign" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not save template."));
      setNotice(`Saved reusable template: ${data.template?.name ?? templateName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template.");
    } finally {
      setBusy(false);
    }
  }

  async function approveCampaign() {
    if (busy || optimisticQueued) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${base}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binding }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not approve campaign."));
      setOptimisticQueued(true);
      setNotice("Approved and queued, not sent. Use Send approved campaign for delivery.");
      const previewResponse = await fetch(`${base}/send`);
      const previewData = await previewResponse.json().catch(() => ({}));
      if (previewResponse.ok) setSendPreview(previewData);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function sendApprovedCampaign() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${base}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binding }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not send campaign."));
      setNotice(
        data.deliverySummary?.campaignDeliveryStatus
          ? `Delivery status: ${data.deliverySummary.campaignDeliveryStatus}`
          : "Send completed.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send campaign.");
    } finally {
      setBusy(false);
    }
  }

  if (!review) return null;

  const orderedSections = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div style={{ display: "grid", gap: spacing.md, padding: spacing.md, borderTop: `1px solid ${cockpitColors.panelBorder}` }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>Campaign studio</div>
        <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
          {review.purpose}
          {review.operationName ? ` · ${review.operationName}` : ""}
          {review.occurrenceKey ? ` · ${review.occurrenceKey}` : ""}
          {review.subjectName ? ` · ${review.subjectName}` : ""}
          {review.contentVersion ? ` · v${review.contentVersion}` : ""}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: spacing.sm }}>
        <div>
          <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>Recipients</div>
          <strong>{review.recipientCount}</strong>
        </div>
        <div>
          <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>Excluded</div>
          <strong>{review.excludedCount}</strong>
        </div>
        <div>
          <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>Delivery truth</div>
          <strong>{approval.statusLabel}</strong>
        </div>
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>Subject line</span>
        <input
          value={subjectLine}
          onChange={(event) => setSubjectLine(event.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>Preview text</span>
        <input
          value={previewText}
          onChange={(event) => setPreviewText(event.target.value)}
          style={inputStyle}
        />
      </label>

      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>Sections</div>
        {orderedSections.map((section, index) => {
          const allowedFields = fieldsForType(section.type);
          return (
            <div key={section.id} style={{ border: `1px solid ${cockpitColors.panelBorder}`, borderRadius: radius.medium, padding: spacing.sm, display: "grid", gap: spacing.xs }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                <strong style={{ color: cockpitColors.textPrimary }}>
                  {typeOptions.find((entry) => entry.id === section.type)?.label ?? section.type}
                </strong>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" style={smallButtonStyle} onClick={() => moveSection(index, -1)} disabled={index === 0}>Up</button>
                  <button type="button" style={smallButtonStyle} onClick={() => moveSection(index, 1)} disabled={index === orderedSections.length - 1}>Down</button>
                  <button
                    type="button"
                    style={smallButtonStyle}
                    onClick={() => setSections((current) => current.filter((entry) => entry.id !== section.id).map((entry, order) => ({ ...entry, order })))}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {allowedFields.map((field) => (
                <label key={field} style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{FIELD_LABELS[field] ?? field}</span>
                  {field === "body" ? (
                    <textarea
                      value={String(section.fields[field as keyof SectionFields] ?? "")}
                      onChange={(event) => updateSectionField(index, field as keyof SectionFields, event.target.value)}
                      rows={3}
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  ) : (
                    <input
                      value={String(section.fields[field as keyof SectionFields] ?? "")}
                      onChange={(event) => updateSectionField(index, field as keyof SectionFields, event.target.value)}
                      style={inputStyle}
                    />
                  )}
                </label>
              ))}
            </div>
          );
        })}
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
          <select value={addType} onChange={(event) => setAddType(event.target.value)} style={inputStyle}>
            {typeOptions.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
          <button
            type="button"
            style={smallButtonStyle}
            onClick={() => setSections((current) => [...current, emptySection(addType, current.length)])}
          >
            Add section
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: spacing.xs }}>
        <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>Recipient preview</div>
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <select value={previewPartyId} onChange={(event) => setPreviewPartyId(event.target.value)} style={inputStyle}>
            <option value="">Shared draft</option>
            {recipients.map((recipient) => (
              <option key={String(recipient.partyId)} value={String(recipient.partyId)}>
                {String(recipient.displayName ?? recipient.partyId)}
              </option>
            ))}
          </select>
          <button type="button" style={smallButtonStyle} onClick={runPreview} disabled={busy}>Preview</button>
        </div>
        {previewBody != null ? (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", color: cockpitColors.textPrimary, lineHeight: 1.5, border: `1px solid ${cockpitColors.panelBorder}`, borderRadius: radius.medium, padding: spacing.sm }}>
            {previewBody || "Empty preview."}
          </pre>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: spacing.xs }}>
        <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>Knowledge sources</div>
        <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
          {knowledgeSummary || review.knowledgeSummary || "No approved knowledge retrieved."}
        </div>
        {knowledgeSources.length ? knowledgeSources.map((source) => (
          <div key={String(source.id)} style={{ border: `1px solid ${cockpitColors.panelBorder}`, borderRadius: radius.medium, padding: spacing.sm }}>
            <div style={{ fontWeight: 650 }}>{String(source.title ?? source.id)}</div>
            <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
              {String(source.reasonSelected ?? "Selected for campaign content")}
            </div>
            <div style={{ marginTop: 4, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
              {String(source.excerpt ?? "")}
            </div>
          </div>
        )) : null}
      </div>

      <div style={{ display: "grid", gap: spacing.xs }}>
        <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>Audience</div>
        {review.evidenceSummary ? <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>{review.evidenceSummary}</div> : null}
        {review.knowledgeSummary ? <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>{review.knowledgeSummary}</div> : null}
        {recipients.slice(0, 6).map((recipient) => (
          <div key={String(recipient.partyId)} style={{ color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
            {String(recipient.displayName ?? recipient.partyId)} — {(recipient.personalizationSummary ?? []).join("; ") || "Evidence-backed recipient"}
          </div>
        ))}
        {review.exclusions.slice(0, 4).map((exclusion) => (
          <div key={String(exclusion.partyId)} style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
            Excluded: {String(exclusion.displayName ?? exclusion.partyId)} — {String(exclusion.reason ?? "Not eligible")}
          </div>
        ))}
      </div>

      {review.guardrails.length ? (
        <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
          {review.guardrails.join(" ")}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={primaryButtonStyle(true)} onClick={saveDraft} disabled={busy}>Save draft</button>
        <button type="button" style={smallButtonStyle} onClick={refreshAudience} disabled={busy}>Refresh audience</button>
        <input
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
          placeholder="Template name"
          style={{ ...inputStyle, minWidth: 180 }}
        />
        <button type="button" style={smallButtonStyle} onClick={saveAsTemplate} disabled={busy}>Save as template</button>
        <button
          type="button"
          disabled={!approval.canApprove}
          onClick={approveCampaign}
          style={primaryButtonStyle(approval.canApprove)}
        >
          {approval.buttonLabel}
        </button>
        <button
          type="button"
          disabled={busy || !(approval.isQueued || optimisticQueued)}
          onClick={sendApprovedCampaign}
          style={primaryButtonStyle(Boolean(approval.isQueued || optimisticQueued))}
        >
          Send approved campaign
        </button>
      </div>
      {sendPreview ? (
        <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
          Send preview: {String(sendPreview.recipientCount ?? 0)} eligible, {String(sendPreview.excludedCount ?? 0)} excluded,
          provider {String(sendPreview.providerStatus ?? "unknown")}.
        </div>
      ) : null}
      {approval.showApprovalHelper ? (
        <span style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
          Review requires prepared content and at least one eligible recipient.
        </span>
      ) : null}
      {notice ? <span style={{ color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>{notice}</span> : null}
      {error ? <span style={{ color: cockpitColors.warning, fontSize: typography.caption.fontSize }}>{error}</span> : null}
    </div>
  );
}

const inputStyle: CSSProperties = {
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.medium,
  padding: "8px 10px",
  background: cockpitColors.panel,
  color: cockpitColors.textPrimary,
  fontSize: typography.caption.fontSize,
};

const smallButtonStyle: CSSProperties = {
  borderRadius: radius.medium,
  border: `1px solid ${cockpitColors.panelBorder}`,
  backgroundColor: cockpitColors.panel,
  color: cockpitColors.textSecondary,
  padding: "8px 12px",
  fontSize: typography.caption.fontSize,
  fontWeight: 650,
  cursor: "pointer",
};

function primaryButtonStyle(enabled: boolean): CSSProperties {
  return {
    borderRadius: radius.medium,
    border: `1px solid ${enabled ? cockpitColors.accent : cockpitColors.panelBorder}`,
    backgroundColor: enabled ? cockpitColors.accent : cockpitColors.panel,
    color: enabled ? "#fff" : cockpitColors.textMuted,
    padding: "8px 12px",
    fontSize: typography.caption.fontSize,
    fontWeight: 700,
    cursor: enabled ? "pointer" : "default",
  };
}
