"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { Section } from "@/components/product";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

import { shouldClearProspectReadinessError } from "@/lib/home/prospectInquiryReadiness.js";

export { shouldClearProspectReadinessError };

export default function ProspectInquiryForm({
  businessId,
  coordinatorReady,
  propertyOptions = [],
}: {
  businessId: string;
  coordinatorReady: boolean;
  propertyOptions?: Array<{ id: string; displayName: string; address?: string | null }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ emailStatus?: string; workId?: string } | null>(null);

  useEffect(() => {
    if (shouldClearProspectReadinessError(error, coordinatorReady)) {
      setError(null);
    }
  }, [coordinatorReady, error]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coordinatorReady || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/prospect-inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message,
          ...(subjectId ? { subjectId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Could not submit inquiry."));
        return;
      }
      setResult({
        emailStatus: data.email?.status,
        workId: data.prospectFollowUpWork?.id,
      });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const emailSent = result.emailStatus === "sent";
    return (
      <Section title="Prospect response" noBorder>
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.large,
            border: `1px solid ${emailSent ? "#bbf7d0" : "#fde68a"}`,
            backgroundColor: emailSent ? "#f0fdf4" : "#fffbeb",
            color: emailSent ? "#166534" : "#92400e",
            fontSize: typography.body.fontSize,
            lineHeight: 1.5,
          }}
        >
          {emailSent
            ? "Follow-up email sent through your connected business email."
            : `Inquiry recorded. Email was not sent (${result.emailStatus ?? "no connection"}). Connect business email first.`}
          {result.workId ? (
            <div style={{ marginTop: spacing.sm }}>
              <SecondaryButton href={`/b/${businessId}/work`}>View work</SecondaryButton>
            </div>
          ) : null}
        </div>
      </Section>
    );
  }

  const submitDisabled = loading || !coordinatorReady;

  return (
    <Section title="Try a prospect inquiry" noBorder>
      <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: `0 0 ${spacing.md}`, lineHeight: 1.5 }}>
        Simulate a prospect reaching out. VIBETech will create follow-up work and send a real response when email is connected.
      </p>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Prospect name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Morgan"
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@example.com"
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Property (optional)</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
          >
            <option value="">No specific property</option>
            {propertyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.displayName}
                {option.address ? ` — ${option.address}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Message</span>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="I'm interested in a 2-bedroom apartment and would like more information."
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}`, resize: "vertical" }}
          />
        </label>
        {error ? (
          <p style={{ color: "#b91c1c", margin: 0, fontSize: typography.caption.fontSize }}>{error}</p>
        ) : null}
        <div>
          <PrimaryButton type="submit" disabled={submitDisabled}>
            {loading ? "Sending…" : "Submit prospect inquiry"}
          </PrimaryButton>
        </div>
      </form>
    </Section>
  );
}
