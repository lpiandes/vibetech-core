"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { buildNewsletterPreviewHtml, type PreviewBrand } from "@/lib/campaigns/newsletterPreviewHtml";
import {
  resolveCampaignApprovalPresentation,
  resolveCampaignReview,
  type WorkQueueItem,
} from "./workQueueSemantics";

type StudioSection = {
  id: string;
  type: string;
  order: number;
  fields: {
    heading?: string | null;
    body?: string | null;
    ctaText?: string | null;
    ctaUrl?: string | null;
    subjectId?: string | null;
  };
};

type ListingOption = { id: string; displayName: string };

function findSection(sections: StudioSection[], type: string) {
  return sections.find((section) => section.type === type) ?? null;
}

function fieldOf(sections: StudioSection[], type: string, key: "heading" | "body" | "ctaText") {
  return String(findSection(sections, type)?.fields?.[key] ?? "");
}

function buildSectionsFromEditor({
  intro,
  highlights,
  listingName,
  listingBody,
  listingId,
  ctaText,
  signature,
  previous,
}: {
  intro: string;
  highlights: string;
  listingName: string;
  listingBody: string;
  listingId: string;
  ctaText: string;
  signature: string;
  previous: StudioSection[];
}): StudioSection[] {
  const keepId = (type: string, fallback: string) => previous.find((s) => s.type === type)?.id ?? fallback;
  const hasListing = Boolean(listingName.trim() || listingId || listingBody.trim());
  const sections: StudioSection[] = [
    {
      id: keepId("intro", "sec_intro"),
      type: "intro",
      order: 0,
      fields: { heading: "This week", body: intro },
    },
    {
      id: keepId("custom_text", "sec_highlights"),
      type: "custom_text",
      order: 1,
      fields: { heading: "Highlights", body: highlights },
    },
  ];
  if (hasListing) {
    sections.push({
      id: keepId("property_feature", "sec_listing"),
      type: "property_feature",
      order: 2,
      fields: {
        heading: listingName.trim() || "Featured listing",
        body: listingBody.trim()
          || (listingName.trim() ? `Featured: ${listingName.trim()}.` : "Featured listing details."),
        subjectId: listingId || null,
      },
    });
  }
  sections.push(
    {
      id: keepId("call_to_action", "sec_cta"),
      type: "call_to_action",
      order: hasListing ? 3 : 2,
      fields: { ctaText: ctaText || "Reply if you want to talk", ctaUrl: "", body: "" },
    },
    {
      id: keepId("contact_signature", "sec_signature"),
      type: "contact_signature",
      order: hasListing ? 4 : 3,
      fields: { heading: "", body: signature || "— The team" },
    },
  );
  return sections;
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
  const [intro, setIntro] = useState("");
  const [highlights, setHighlights] = useState("");
  const [ctaText, setCtaText] = useState("Reply if you want to talk");
  const [signature, setSignature] = useState("— The team");
  const [listingId, setListingId] = useState("");
  const [listingName, setListingName] = useState("");
  const [listingBody, setListingBody] = useState("");
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brand, setBrand] = useState<PreviewBrand | null>(null);
  const [binding, setBinding] = useState<Record<string, unknown> | null>(null);
  const [previousSections, setPreviousSections] = useState<StudioSection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [optimisticQueued, setOptimisticQueued] = useState(false);

  const base = `/api/businesses/${encodeURIComponent(businessId)}/campaigns/work/${encodeURIComponent(String(item.id))}`;

  useEffect(() => {
    setOptimisticQueued(false);
    setError(null);
    setNotice(null);
    let cancelled = false;
    async function load() {
      try {
        const [campaignRes, subjectsRes] = await Promise.all([
          fetch(base),
          fetch(`/api/businesses/${encodeURIComponent(businessId)}/subjects`),
        ]);
        const data = await campaignRes.json().catch(() => ({}));
        const subjectsData = await subjectsRes.json().catch(() => ({}));
        if (!campaignRes.ok) throw new Error(String(data?.error ?? "Could not load newsletter."));
        if (cancelled) return;

        const document = data.document ?? {};
        const sections = (Array.isArray(document.sections) ? document.sections : []) as StudioSection[];
        setPreviousSections(sections);
        setSubjectLine(String(document.subjectLine ?? review?.draftSubject ?? ""));
        setPreviewText(String(document.previewText ?? ""));
        setIntro(fieldOf(sections, "intro", "body") || "Here is this week’s update.");
        setHighlights(fieldOf(sections, "custom_text", "body") || "Add what you want people to know.");
        setCtaText(fieldOf(sections, "call_to_action", "ctaText") || "Reply if you want to talk");
        setSignature(fieldOf(sections, "contact_signature", "body") || "— The team");
        const property = findSection(sections, "property_feature");
        setListingId(String(property?.fields?.subjectId ?? ""));
        setListingName(String(property?.fields?.heading ?? ""));
        setListingBody(String(property?.fields?.body ?? ""));
        setBinding(data.expectedApprovalBinding ?? null);
        setBrand(data.brand ?? null);

        const rows = Array.isArray(subjectsData?.subjects)
          ? subjectsData.subjects
          : Array.isArray(subjectsData?.items)
            ? subjectsData.items
            : [];
        setListings(
          rows
            .map((row: any) => ({
              id: String(row.id ?? row.subjectId ?? ""),
              displayName: String(row.displayName ?? row.name ?? row.id ?? ""),
            }))
            .filter((row: ListingOption) => row.id && row.displayName),
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load newsletter.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [base, businessId, item.id, review?.draftSubject]);

  const sections = useMemo(
    () => buildSectionsFromEditor({
      intro,
      highlights,
      listingName,
      listingBody,
      listingId,
      ctaText,
      signature,
      previous: previousSections,
    }),
    [intro, highlights, listingName, listingBody, listingId, ctaText, signature, previousSections],
  );

  const livePreview = useMemo(
    () => buildNewsletterPreviewHtml({
      subjectLine,
      previewText,
      sections,
      brand,
      recipientName: review?.recipients?.[0]?.displayName ?? "Alex",
    }),
    [subjectLine, previewText, sections, brand, review?.recipients],
  );

  const approval = resolveCampaignApprovalPresentation(item, { requestPending: busy, optimisticQueued });
  const recipients = review?.recipients ?? [];
  const recipientLabel = review?.recipientCount
    ? `${review.recipientCount} people`
    : "No one yet";

  async function saveDraft() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${base}/document`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectLine, previewText, sections }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not save."));
      setPreviousSections(sections);
      setNotice("Saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshAudience() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${base}/audience/refresh`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not refresh."));
      setNotice(data.fingerprintChanged ? "Updated who gets it." : "Same people.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh.");
    } finally {
      setBusy(false);
    }
  }

  async function generateFromWebsite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${base}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: websiteUrl || null,
          listingName: listingName || null,
          businessName: brand?.businessName ?? null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(String(data?.error ?? "Could not generate."));
      const draft = data.draft ?? {};
      if (draft.subjectLine) setSubjectLine(String(draft.subjectLine));
      if (draft.previewText != null) setPreviewText(String(draft.previewText));
      if (draft.intro) setIntro(String(draft.intro));
      if (draft.highlights) setHighlights(String(draft.highlights));
      if (draft.listingBody) setListingBody(String(draft.listingBody));
      if (draft.ctaText) setCtaText(String(draft.ctaText));
      if (draft.signature) setSignature(String(draft.signature));
      setNotice(
        data.websiteFetched
          ? "Draft filled from website — preview updated on the right."
          : "Draft filled — add a website URL for richer copy. Preview updated on the right.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate.");
    } finally {
      setBusy(false);
    }
  }

  async function approveCampaign() {
    if (busy || optimisticQueued) return;
    setBusy(true);
    setError(null);
    try {
      await saveDraftSilent();
      const response = await fetch(`${base}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binding }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not approve."));
      setOptimisticQueued(true);
      setNotice("Approved — ready to send.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraftSilent() {
    const response = await fetch(`${base}/document`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectLine, previewText, sections }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.error ?? "Could not save."));
    setPreviousSections(sections);
  }

  async function sendApprovedCampaign() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${base}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binding }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error ?? "Could not send."));
      setNotice("Sent.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  if (!review) return null;

  return (
    <div style={{ display: "grid", gap: spacing.md, padding: spacing.md, borderTop: `1px solid ${cockpitColors.panelBorder}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>Newsletter</div>
        <div style={{ color: cockpitColors.textMuted, fontSize: 12 }}>{recipientLabel} · {approval.statusLabel}</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(300px, 1.1fr)",
          gap: 16,
          alignItems: "start",
        }}
        className="vt-newsletter-studio"
      >
        <div style={{ display: "grid", gap: 12 }}>
          <label style={labelStyle}>
            Subject
            <input value={subjectLine} onChange={(e) => setSubjectLine(e.target.value)} style={inputStyle} placeholder="What people see in their inbox" />
          </label>

          <label style={labelStyle}>
            Inbox preview line
            <input value={previewText} onChange={(e) => setPreviewText(e.target.value)} style={inputStyle} placeholder="Short snippet under the subject" />
          </label>

          <label style={labelStyle}>
            Intro
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </label>

          <label style={labelStyle}>
            Highlights
            <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.textMuted }}>Listing (optional)</div>
            {listings.length > 0 ? (
              <select
                value={listingId}
                onChange={(e) => {
                  const id = e.target.value;
                  setListingId(id);
                  const hit = listings.find((row) => row.id === id);
                  if (hit) {
                    setListingName(hit.displayName);
                    if (!listingBody.trim()) setListingBody(`Featured: ${hit.displayName}.`);
                  } else {
                    setListingName("");
                    setListingBody("");
                  }
                }}
                style={inputStyle}
              >
                <option value="">No listing</option>
                {listings.map((row) => (
                  <option key={row.id} value={row.id}>{row.displayName}</option>
                ))}
              </select>
            ) : null}
            <input
              value={listingName}
              onChange={(e) => setListingName(e.target.value)}
              placeholder="House / listing name"
              style={inputStyle}
            />
            <textarea
              value={listingBody}
              onChange={(e) => setListingBody(e.target.value)}
              rows={3}
              placeholder="What to say about this listing"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <label style={labelStyle}>
            Call to action
            <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} style={inputStyle} />
          </label>

          <label style={labelStyle}>
            Signature
            <input value={signature} onChange={(e) => setSignature(e.target.value)} style={inputStyle} />
          </label>

          <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: radius.medium, border: `1px solid ${cockpitColors.panelBorder}`, background: cockpitColors.panelElevated }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: cockpitColors.textPrimary }}>Generate from website</div>
            <div style={{ fontSize: 12, color: cockpitColors.textMuted }}>
              Fills the fields on the left. The preview on the right updates immediately.
            </div>
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="annmcbride.com"
              style={inputStyle}
            />
            <button type="button" style={primaryButtonStyle(true)} onClick={() => void generateFromWebsite()} disabled={busy}>
              {busy ? "Working…" : "Generate draft"}
            </button>
          </div>

          {recipients.length > 0 ? (
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>Sending to</div>
              {recipients.slice(0, 6).map((recipient) => (
                <div key={String(recipient.partyId)} style={{ fontSize: 12, color: cockpitColors.textSecondary }}>
                  {String(recipient.displayName ?? recipient.partyId)}
                  {recipient.email ? ` · ${String(recipient.email)}` : ""}
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={primaryButtonStyle(true)} onClick={() => void saveDraft()} disabled={busy}>Save</button>
            <button type="button" style={smallButtonStyle} onClick={() => void refreshAudience()} disabled={busy}>Refresh who gets it</button>
            <button type="button" style={primaryButtonStyle(approval.canApprove)} onClick={() => void approveCampaign()} disabled={!approval.canApprove || busy}>Approve</button>
            <button type="button" style={primaryButtonStyle(Boolean(approval.isQueued || optimisticQueued))} onClick={() => void sendApprovedCampaign()} disabled={busy || !(approval.isQueued || optimisticQueued)}>Send</button>
          </div>
          {approval.showApprovalHelper && !review.recipientCount ? (
            <div style={{ fontSize: 12, color: cockpitColors.textMuted }}>Add people with email, then Refresh who gets it.</div>
          ) : null}
          {notice ? <div style={{ fontSize: 12, color: cockpitColors.textSecondary }}>{notice}</div> : null}
          {error ? <div style={{ fontSize: 12, color: cockpitColors.warning }}>{error}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 8, position: "sticky", top: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: cockpitColors.textMuted }}>Exact email preview</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.textPrimary }}>
            Subject: {livePreview.subject}
          </div>
          <iframe
            title="Newsletter preview"
            sandbox=""
            srcDoc={livePreview.html}
            style={{
              width: "100%",
              minHeight: 520,
              border: `1px solid ${cockpitColors.panelBorder}`,
              borderRadius: 16,
              background: "#f1f5f9",
            }}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .vt-newsletter-studio { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: cockpitColors.textMuted,
};

const inputStyle: CSSProperties = {
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.medium,
  padding: "10px 12px",
  font: "inherit",
  fontWeight: 600,
  color: cockpitColors.textPrimary,
  background: cockpitColors.panel,
};

const smallButtonStyle: CSSProperties = {
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: 10,
  padding: "8px 12px",
  background: cockpitColors.panel,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

function primaryButtonStyle(enabled: boolean): CSSProperties {
  return {
    border: "none",
    borderRadius: 10,
    padding: "8px 14px",
    background: enabled ? cockpitColors.accent : "rgba(15,118,110,0.35)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 12,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
