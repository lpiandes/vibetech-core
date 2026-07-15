"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export type AiTeammateDetailModel = {
  employeeId: string;
  name: string;
  role: string;
  purpose: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "neutral";
  ownerAdded: boolean;
  askAssisted: boolean;
  canRunJobs: boolean;
  canDoToday: string[];
  cannotDoYet: string[];
  blockers: string[];
  askHref: string;
  setupHref: string | null;
  workHref: string;
  teamHref: string;
  specialtyHref?: string | null;
  businessId: string;
  automationsActive?: boolean | null;
};

export default function AiTeammateDetail({ model }: { model: AiTeammateDetailModel }) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<"run" | "auto" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runJob() {
    setBusy("run");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(model.businessId)}/team/${encodeURIComponent(model.employeeId)}/run`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            brief,
            label: model.name,
            purpose: model.purpose,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.reason ?? json?.error ?? "Could not run job");
      }
      setMessage(`Job completed. Open Work to review the deliverable.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run job");
    } finally {
      setBusy(null);
    }
  }

  async function toggleAutomations() {
    const next = model.automationsActive === false ? "ACTIVE" : "INACTIVE";
    setBusy("auto");
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(model.businessId)}/team/${encodeURIComponent(model.employeeId)}/automations/status`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Could not update automations");
      }
      setMessage(next === "ACTIVE" ? "Automations turned on." : "Automations turned off.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update automations");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: spacing.xl, maxWidth: 720 }}>
      <div>
        <Link
          href={model.teamHref}
          style={{
            color: cockpitColors.textMuted,
            fontSize: typography.caption.fontSize,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Team
        </Link>
      </div>

      <PageHeader
        title={model.name}
        description={model.purpose || model.role || "AI teammate"}
        action={<StatusBadge label={model.statusLabel} tone={model.statusTone} />}
      />

      <section style={{ display: "grid", gap: spacing.sm }}>
        <h2 style={{ ...typography.sectionTitle, margin: 0, color: cockpitColors.textPrimary }}>
          Run a job
        </h2>
        <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
          Tell this teammate what to produce. They create durable Work with an artifact you can review.
          Nothing is sent to customers without approval.
        </p>
        <textarea
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder={`e.g. Build this week's practice plan for ${model.name}`}
          rows={3}
          style={{
            width: "100%",
            borderRadius: 8,
            border: `1px solid ${cockpitColors.panelBorder}`,
            padding: spacing.md,
            font: "inherit",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
          {model.specialtyHref ? (
            <PrimaryButton href={model.specialtyHref}>Open specialty page</PrimaryButton>
          ) : (
            <PrimaryButton onClick={runJob} disabled={busy === "run"}>
              {busy === "run" ? "Running…" : "Run job"}
            </PrimaryButton>
          )}
          <SecondaryButton onClick={runJob} disabled={busy === "run"}>
            {busy === "run" ? "Running…" : "Run job here"}
          </SecondaryButton>
          <SecondaryButton href={model.askHref}>Ask this teammate</SecondaryButton>
          <SecondaryButton href={model.workHref}>Open Work</SecondaryButton>
        </div>
      </section>

      <section style={{ display: "grid", gap: spacing.sm }}>
        <h2 style={{ ...typography.sectionTitle, margin: 0, color: cockpitColors.textPrimary }}>
          Automations
        </h2>
        <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
          Turn linked automations on or off. Outbound sends still need your approval when on.
        </p>
        <SecondaryButton onClick={toggleAutomations} disabled={busy === "auto"}>
          {busy === "auto"
            ? "Saving…"
            : model.automationsActive === false
              ? "Turn automations on"
              : "Turn automations off"}
        </SecondaryButton>
      </section>

      <section style={{ display: "grid", gap: spacing.sm }}>
        <h2 style={{ ...typography.sectionTitle, margin: 0, color: cockpitColors.textPrimary }}>
          What they can do today
        </h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
          {model.canDoToday.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {model.cannotDoYet.length > 0 ? (
        <section style={{ display: "grid", gap: spacing.sm }}>
          <h2 style={{ ...typography.sectionTitle, margin: 0, color: cockpitColors.textPrimary }}>
            Not available without approval
          </h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
            {model.cannotDoYet.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {model.blockers.length > 0 ? (
        <section style={{ display: "grid", gap: spacing.sm }}>
          <h2 style={{ ...typography.sectionTitle, margin: 0, color: cockpitColors.textPrimary }}>
            Why blocked
          </h2>
          <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
            AI teammates need Knowledge and Connections the same way people do. Fix these, then re-run.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
            {model.blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
            {model.setupHref ? <SecondaryButton href={model.setupHref}>Finish setup</SecondaryButton> : null}
            <SecondaryButton href={`/b/${model.businessId}/knowledge?add=1`}>Add Knowledge</SecondaryButton>
            <SecondaryButton href={`/b/${model.businessId}/integrations`}>Connections</SecondaryButton>
          </div>
        </section>
      ) : null}

      {message ? (
        <p style={{ margin: 0, color: cockpitColors.accent, fontSize: typography.caption.fontSize }}>{message}</p>
      ) : null}
      {error ? (
        <p style={{ margin: 0, color: "#b42318", fontSize: typography.caption.fontSize }}>{error}</p>
      ) : null}

      {!model.blockers.length && model.setupHref ? <SecondaryButton href={model.setupHref}>Finish setup</SecondaryButton> : null}
    </div>
  );
}
