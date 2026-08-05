/**
 * Campaign-lite: save template → Prepare → open Work for approve/send.
 */
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { cockpitColors } from "@/design/tokens";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";

export default function CampaignLitePage() {
  const params = useParams();
  const router = useRouter();
  const businessId = String(params?.businessId ?? "");
  const [templates, setTemplates] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!businessId) return;
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/campaigns/templates`);
    const data = await res.json().catch(() => ({}));
    const business = Array.isArray(data.businessTemplates) ? data.businessTemplates : [];
    const alias = Array.isArray(data.templates) ? data.templates : [];
    const merged = business.length
      ? business
      : alias.filter((tpl: any) => String(tpl.origin ?? "") !== "package" && !tpl.immutable);
    setTemplates(merged);
  }

  useEffect(() => {
    void refresh();
  }, [businessId]);

  async function createTemplate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/campaigns/templates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name || (channel === "sms" ? "SMS campaign" : "Email campaign"),
          channel,
          subjectLine: subject,
          body,
          audience: { type: "all_marketable_contacts" },
          approvalRequired: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error ?? "Could not save template.");
      setMessage("Template saved. Click Prepare & review to create Work, then approve before send.");
      setName("");
      setSubject("");
      setBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function prepareTemplate(tpl: any) {
    const templateId = String(tpl?.id ?? "");
    if (!businessId || !templateId) return;
    setPreparingId(templateId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/campaigns/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessTemplateId: templateId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error ?? data.message ?? "Could not prepare campaign.");
      }
      const href = String(data.workHref ?? "").trim()
        || (data.workId
          ? `/b/${encodeURIComponent(businessId)}/work?workId=${encodeURIComponent(String(data.workId))}`
          : "");
      if (!href) throw new Error("Prepared, but no Work link returned.");
      setMessage("Campaign prepared — approve and send from Work.");
      router.push(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prepare failed.");
    } finally {
      setPreparingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px", display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, color: cockpitColors.textPrimary }}>Campaigns</h1>
        <p style={{ margin: "8px 0 0", color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
          Build an email or SMS for marketable contacts, prepare it into Work, then approve before anything sends.
          This is campaign-lite — not a full ESP.
        </p>
      </div>

      <section style={{
        border: `1px solid ${cockpitColors.panelBorder}`,
        borderRadius: 12,
        padding: 16,
        display: "grid",
        gap: 10,
        background: cockpitColors.panel,
      }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campaign name"
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 12 }}>
          <label style={checkLabel}>
            <input type="radio" checked={channel === "email"} onChange={() => setChannel("email")} />
            Email
          </label>
          <label style={checkLabel}>
            <input type="radio" checked={channel === "sms"} onChange={() => setChannel("sms")} />
            SMS
          </label>
        </div>
        {channel === "email" ? (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            style={inputStyle}
          />
        ) : null}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={channel === "sms" ? "SMS body" : "Email body"}
          rows={6}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <PrimaryButton onClick={() => void createTemplate()} disabled={busy || !body.trim()}>
            {busy ? "Saving…" : "Save template"}
          </PrimaryButton>
          <SecondaryButton onClick={() => void refresh()} disabled={busy}>
            Refresh
          </SecondaryButton>
        </div>
        {message ? <p style={{ margin: 0, color: cockpitColors.accent, fontWeight: 700 }}>{message}</p> : null}
        {error ? <p style={{ margin: 0, color: cockpitColors.critical, fontWeight: 700 }}>{error}</p> : null}
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Saved templates</h2>
        {!templates.length ? (
          <p style={{ color: cockpitColors.textMuted }}>No templates yet. Save one above, then Prepare & review.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {templates.map((tpl) => {
              const id = String(tpl.id ?? tpl.name);
              const preparing = preparingId === id;
              return (
                <li
                  key={id}
                  style={{
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    borderRadius: 12,
                    padding: 14,
                    background: cockpitColors.panel,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div>
                    <strong>{tpl.name ?? "Untitled"}</strong>
                    {" · "}
                    {tpl.channel ?? "email"}
                    {tpl.subjectLine ? ` · ${tpl.subjectLine}` : ""}
                  </div>
                  <PrimaryButton
                    onClick={() => void prepareTemplate(tpl)}
                    disabled={Boolean(preparingId)}
                  >
                    {preparing ? "Preparing…" : "Prepare & review"}
                  </PrimaryButton>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const inputStyle: CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${cockpitColors.panelBorder}`,
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const checkLabel: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  fontSize: 13,
  color: cockpitColors.textSecondary,
};
