"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

/**
 * Public iframe form for website embeds — minimal chrome for third-party sites.
 */
export default function EmbedFormPage() {
  const params = useParams();
  const businessId = String(params?.businessId ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/forms/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          message,
          website: honeypot,
          source: "embed",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not submit");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d6d3d1",
    fontSize: 14,
    fontFamily: "inherit",
  };

  if (done) {
    return (
      <main style={{ fontFamily: "system-ui, sans-serif", padding: 20, color: "#1c1917" }}>
        <p style={{ fontWeight: 700, margin: 0 }}>Thanks — we got your message.</p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16, color: "#1c1917", background: "#fff" }}>
      <form onSubmit={(e) => void submit(e)} style={{ display: "grid", gap: 10 }}>
        <strong style={{ fontSize: 16 }}>Contact us</strong>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={field} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={field} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={field} />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={3} style={field} />
        {/* Honeypot — leave empty */}
        <input
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
          name="website"
        />
        <button
          type="submit"
          disabled={busy || (!name && !email && !phone)}
          style={{
            padding: "11px 14px",
            borderRadius: 10,
            border: 0,
            background: "#0f766e",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {busy ? "…" : "Send"}
        </button>
        {error ? <p style={{ color: "#b91c1c", margin: 0, fontWeight: 650 }}>{error}</p> : null}
      </form>
    </main>
  );
}
