"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import SpecialtyDeliverableView, {
  type SpecialtyArtifactPreview,
} from "@/components/specialty/SpecialtyDeliverableView";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export type SpecialtyWorkItem = {
  id: string;
  title: string;
  status: string;
  updatedAt?: string | null;
  artifactTitle?: string | null;
  artifactBody?: string | null;
  artifact?: SpecialtyArtifactPreview | null;
  workHref?: string | null;
};

export type SpecialtySurfaceModel = {
  businessId: string;
  surfaceId: string;
  surfaceKind: "module" | "ai_teammate";
  name: string;
  purpose: string;
  blocks: string[];
  employeeId: string | null;
  statusLabel: string;
  askHref: string;
  workHref: string;
  knowledgeHref: string;
  integrationsHref: string;
  teamHref: string;
  workItems: SpecialtyWorkItem[];
  automationsActive?: boolean | null;
  linkedAutomationCount?: number;
  readiness?: {
    ready?: boolean;
    missingKnowledge?: string[];
    missingConnections?: string[];
    blockerSummary?: string | null;
  } | null;
};

function Block({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ display: "grid", gap: spacing.sm }}>
      <h2 style={{ ...typography.sectionTitle, margin: 0, color: cockpitColors.textPrimary }}>{title}</h2>
      {children}
    </section>
  );
}

export default function SpecialtySurfaceExperience({ model }: { model: SpecialtySurfaceModel }) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<"run" | "auto" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [automationsActive, setAutomationsActive] = useState(model.automationsActive ?? null);
  const [previewArtifact, setPreviewArtifact] = useState<SpecialtyArtifactPreview | null>(() => {
    return pickLatestArtifact(model);
  });

  useEffect(() => {
    setPreviewArtifact(pickLatestArtifact(model));
  }, [model.workItems, model.workHref]);

  const blocks = new Set(model.blocks);
  const canRun = model.surfaceKind === "ai_teammate" && Boolean(model.employeeId);
  const openWorkHref = previewArtifact?.workHref
    || model.workItems[0]?.workHref
    || model.workHref;
  const hasLinkedAutomations = Number(model.linkedAutomationCount ?? 0) > 0
    || automationsActive === true
    || automationsActive === false;

  async function runJob() {
    if (!model.employeeId) return;
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
      const artifact = json?.result?.artifact;
      const workHref = json?.result?.workHref ?? openWorkHref;
      if (artifact) {
        setPreviewArtifact({
          ...artifact,
          title: String(artifact.title ?? "Specialty deliverable"),
          body: String(artifact.body ?? ""),
          workHref,
        });
      }
      setMessage(
        Array.isArray(artifact?.gaps) && artifact.gaps.length
          ? "Structure ready, but curriculum sources are missing. Attach materials in Knowledge, then re-run."
          : "Deliverable ready for review. Open Work to see it in the queue.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run job");
    } finally {
      setBusy(null);
    }
  }

  async function toggleAutomations() {
    if (!model.employeeId || !hasLinkedAutomations) return;
    const next = automationsActive === false ? "ACTIVE" : "INACTIVE";
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
      const changed = Array.isArray(json?.result?.results) ? json.result.results.length : null;
      if (changed === 0) {
        setMessage("No linked automations for this teammate yet.");
      } else {
        setAutomationsActive(next === "ACTIVE");
        setMessage(next === "ACTIVE" ? "Automations turned on." : "Automations turned off.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update automations");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: spacing.xl, maxWidth: 960 }}>
      <PageHeader
        title={model.name}
        description={model.purpose || "Specialty workspace"}
        action={<StatusBadge label={model.statusLabel} tone="success" />}
      />

      {blocks.has("overview") ? (
        <Block title="Overview">
          <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
            {model.surfaceKind === "ai_teammate"
              ? `${model.name} runs specialty jobs as durable Work. You hire AI teammates the way you hire people — they need Knowledge and Connections, and you supervise outcomes on Work.`
              : `${model.name} is a specialty workspace for this business. Use Work, Knowledge, and connections below — no custom code required.`}
          </p>
        </Block>
      ) : null}

      {model.readiness && model.readiness.ready === false ? (
        <Block title="Why this teammate is blocked">
          <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
            {model.readiness.blockerSummary
              || "Missing Knowledge or Connections. Upload citeable materials and reconnect channels before expecting specialty quality."}
          </p>
          {model.readiness.missingKnowledge?.length ? (
            <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
              Needs Knowledge: {model.readiness.missingKnowledge.join(", ")}
            </p>
          ) : null}
          {model.readiness.missingConnections?.length ? (
            <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
              Needs Connections: {model.readiness.missingConnections.join(", ")}
            </p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
            <PrimaryButton href={`${model.knowledgeHref}${model.knowledgeHref.includes("?") ? "&" : "?"}add=1`}>
              Add Knowledge
            </PrimaryButton>
            <SecondaryButton href={model.integrationsHref}>Fix Connections</SecondaryButton>
          </div>
        </Block>
      ) : null}

      {!previewArtifact && model.workItems.length === 0 ? (
        <Block title="No specialty deliverable yet">
          <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
            Specialty work cites Business Knowledge (and registered authorities when available). If curriculum or SOPs are missing, upload them first — VIBETech will not invent drills or policies.
          </p>
          <SecondaryButton href={`${model.knowledgeHref}${model.knowledgeHref.includes("?") ? "&" : "?"}add=1`}>
            Open Knowledge to add materials
          </SecondaryButton>
        </Block>
      ) : null}

      {blocks.has("run_job") && canRun ? (
        <Block title="Run a job">
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder={`What should ${model.name} produce?`}
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
            <PrimaryButton onClick={runJob} disabled={busy === "run"}>
              {busy === "run" ? "Running…" : "Run job"}
            </PrimaryButton>
            {blocks.has("ask") ? <SecondaryButton href={model.askHref}>Ask this teammate</SecondaryButton> : null}
          </div>
        </Block>
      ) : null}

      {previewArtifact ? (
        <Block title="Latest deliverable">
          <div
            style={{
              border: `1px solid ${cockpitColors.panelBorder}`,
              borderRadius: 12,
              padding: spacing.md,
              background: cockpitColors.panel,
            }}
          >
            <SpecialtyDeliverableView
              artifact={previewArtifact}
              openHref={previewArtifact.workHref || openWorkHref}
              knowledgeHref={model.knowledgeHref}
            />
          </div>
        </Block>
      ) : null}

      {blocks.has("work") ? (
        <Block title="Recent work">
          {model.workItems.length === 0 ? (
            <p style={{ margin: 0, color: cockpitColors.textMuted }}>No specialty work yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
              {model.workItems.map((item) => (
                <li key={item.id}>
                  <Link href={item.workHref || openWorkHref} style={{ color: cockpitColors.accent, fontWeight: 600 }}>
                    {item.title}
                  </Link>
                  {" — "}
                  {item.status}
                  {item.artifactTitle ? ` · ${item.artifactTitle}` : ""}
                </li>
              ))}
            </ul>
          )}
          <SecondaryButton href={openWorkHref}>Open Work</SecondaryButton>
        </Block>
      ) : null}

      {blocks.has("automations") && model.employeeId ? (
        <Block title="Automations">
          {hasLinkedAutomations ? (
            <>
              <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
                Turn linked automations on or off. Outbound sends still need approval.
              </p>
              <SecondaryButton onClick={toggleAutomations} disabled={busy === "auto"}>
                {busy === "auto"
                  ? "Saving…"
                  : automationsActive === false
                    ? "Turn automations on"
                    : "Turn automations off"}
              </SecondaryButton>
            </>
          ) : (
            <p style={{ margin: 0, color: cockpitColors.textMuted, lineHeight: 1.5 }}>
              No linked automations for this teammate yet. Run jobs create Work for review; outbound still always needs approval.
            </p>
          )}
        </Block>
      ) : null}

      {blocks.has("ask") && !blocks.has("run_job") ? (
        <Block title="Ask">
          <SecondaryButton href={model.askHref}>Ask VIBETech</SecondaryButton>
        </Block>
      ) : null}

      {blocks.has("knowledge") || blocks.has("integrations") ? (
        <Block title="Setup shortcuts">
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
            {blocks.has("knowledge") ? (
              <SecondaryButton href={model.knowledgeHref}>Knowledge</SecondaryButton>
            ) : null}
            {blocks.has("integrations") ? (
              <SecondaryButton href={model.integrationsHref}>Connections</SecondaryButton>
            ) : null}
            <SecondaryButton href={model.teamHref}>Team</SecondaryButton>
          </div>
        </Block>
      ) : null}

      {message ? (
        <p style={{ margin: 0, color: cockpitColors.accent, fontSize: typography.caption.fontSize }}>{message}</p>
      ) : null}
      {error ? (
        <p style={{ margin: 0, color: "#b42318", fontSize: typography.caption.fontSize }}>{error}</p>
      ) : null}

      <Link
        href={model.teamHref}
        style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize, fontWeight: 600 }}
      >
        ← Team
      </Link>
    </div>
  );
}

function pickLatestArtifact(model: SpecialtySurfaceModel): SpecialtyArtifactPreview | null {
  const latest = model.workItems.find((item) => item.artifact?.diagram)
    ?? model.workItems.find((item) => item.artifact?.kind === "specialty_deliverable")
    ?? model.workItems[0];
  if (!latest) return null;
  return {
    ...(latest.artifact ?? {}),
    title: String(latest.artifact?.title ?? latest.artifactTitle ?? latest.title),
    body: String(latest.artifact?.body ?? latest.artifactBody ?? ""),
    workHref: latest.workHref ?? model.workHref,
  };
}
