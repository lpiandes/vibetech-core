"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

import PrimaryButton from "@/components/product/PrimaryButton";
import { VtHero, VtPage, VtPanel, vtInputStyle } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

/**
 * Simple hosted intake form owners can share. Submissions → People + pipeline + FORM_SUBMISSION automations.
 */
export default function IntakeFormPage() {
  const params = useParams();
  const businessId = String(params?.businessId ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [requestAppointment, setRequestAppointment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!businessId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/forms/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message, appointmentRequest: requestAppointment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not submit");
      setDone(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setRequestAppointment(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/b/${businessId}/intake`
    : `/b/${businessId}/intake`;
  const embedSnippet = typeof window !== "undefined"
    ? `<script src="${window.location.origin}/embed/${businessId}/form.js" async></script>`
    : `<script src="/embed/${businessId}/form.js" async></script>`;

  return (
    <VtPage>
      <VtHero eyebrow="Intake" title="Website form">
        <p style={{ margin: "8px 0 0", fontSize: 14, opacity: 0.9, maxWidth: 560, lineHeight: 1.45 }}>
          Share the link or paste the embed snippet on your site. Submissions create contacts in People and can run intake automations.
        </p>
      </VtHero>

      <VtPanel title="Share link">
        <code style={{
          display: "block",
          padding: 12,
          borderRadius: 10,
          background: "#f5f5f4",
          border: `1px solid ${cockpitColors.panelBorder}`,
          fontSize: 13,
          wordBreak: "break-all",
          fontWeight: 650,
        }}>
          {shareUrl}
        </code>
      </VtPanel>

      <VtPanel title="Embed on your website">
        <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>
          Paste this once where you want the form to appear:
        </p>
        <code style={{
          display: "block",
          padding: 12,
          borderRadius: 10,
          background: "#f5f5f4",
          border: `1px solid ${cockpitColors.panelBorder}`,
          fontSize: 12,
          wordBreak: "break-all",
          fontWeight: 650,
        }}>
          {embedSnippet}
        </code>
      </VtPanel>

      <VtPanel title="Preview / test form">
        {done ? (
          <p style={{ margin: 0, fontWeight: 750, color: "#047857" }}>
            Submitted. Check People (and Needs Attention if an automation drafted a follow-up).
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={vtInputStyle} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={vtInputStyle} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={vtInputStyle} />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={3} style={vtInputStyle} />
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 650 }}>
              <input
                type="checkbox"
                checked={requestAppointment}
                onChange={(e) => setRequestAppointment(e.target.checked)}
              />
              Request an appointment (creates Work + calendar HOLD when Calendar is connected)
            </label>
            <PrimaryButton onClick={() => void submit()} disabled={busy || (!name && !email && !phone)}>
              {busy ? "…" : "Submit test lead"}
            </PrimaryButton>
          </div>
        )}
        {error ? <p style={{ color: cockpitColors.critical, fontWeight: 750 }}>{error}</p> : null}
      </VtPanel>
    </VtPage>
  );
}
