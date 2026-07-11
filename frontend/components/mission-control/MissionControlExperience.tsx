"use client";

import { useContext, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import DemoStoryMode from "./DemoStoryMode";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type Experience = {
  executiveBriefing?: {
    headline?: string;
    summary?: string;
    whatChanged?: string[];
    whatNeedsAttention?: string[];
    topRecommendation?: { title?: string; reason?: string; confidence?: string } | null;
    nextHumanStep?: string;
  };
  businessIntelligence?: { honesty?: string; observationCounts?: Record<string, number>; pipeline?: string[] };
  businessHealth?: {
    overallScore?: number | null;
    overallStatus?: string;
    overallTrend?: string;
    overallConfidence?: string;
    explanation?: string;
    strengths?: Array<{ id: string; label: string; reason?: string }>;
    risks?: Array<{ id: string; label: string; reason?: string }>;
  };
  aiWorkforceActivity?: {
    digitalEmployees?: Array<{
      id: string;
      name?: string;
      role?: string;
      status?: string;
      currentHandling?: string;
      needsFromOwner?: string;
    }>;
    handledByVibeTech?: Array<{ id?: string; title?: string; summary?: string }>;
  };
  activeBusinessEpisodes?: Array<{
    episodeId?: string;
    title?: string;
    summary?: string;
    operatingStateLabel?: string;
    whatNeedsHumanAttention?: string;
    whatHappensNext?: string;
  }>;
  waitingOnYou?: Array<{
    id: string;
    title?: string;
    summary?: string;
    reason?: string;
    priorityBadge?: string;
    availableActions?: Array<{ label?: string; href?: string }>;
  }>;
  aiOpportunities?: Array<{ recommendationId?: string; title?: string; summary?: string; reason?: string; improvePrompt?: string }>;
  businessTimeline?: Array<{ id?: string; title?: string; summary?: string; occurredAt?: string }>;
  capacity?: Array<{ recommendationId?: string; title?: string; summary?: string; estimatedSavings?: string | null }>;
  risks?: Array<{ recommendationId?: string; title?: string; reason?: string; risk?: string }>;
  recommendations?: Array<{
    recommendationId: string;
    title: string;
    summary?: string;
    reason?: string;
    confidence?: string;
    businessImpact?: string;
    evidence?: Array<{ label: string }>;
    improvePrompt?: string;
    risk?: string;
  }>;
  recentlyImproved?: Array<{ id: string; label: string; at?: string | null }>;
  upcomingWork?: Array<{ id?: string; title?: string; summary?: string; status?: string }>;
  recentCommunications?: Array<{ id: string; label: string; summary?: string | null; href?: string | null }>;
  criticalMetrics?: Array<{ id: string; label: string; value: string | number; trend?: string | null }>;
  businessControlStatus?: { label?: string; reason?: string; tone?: string } | null;
  operatingStates?: Array<{ id: string; label?: string; count?: number }>;
  fabricatedMetricsForbidden?: boolean;
};

const SECTIONS = [
  { id: "briefing", label: "Executive Briefing" },
  { id: "waiting", label: "Waiting On You" },
  { id: "episodes", label: "Active Episodes" },
  { id: "workforce", label: "AI Workforce" },
  { id: "health", label: "Business Health" },
  { id: "recommendations", label: "Recommendations" },
  { id: "opportunities", label: "AI Opportunities" },
  { id: "capacity", label: "Capacity" },
  { id: "risks", label: "Risks" },
  { id: "metrics", label: "Critical Metrics" },
  { id: "timeline", label: "Business Timeline" },
  { id: "upcoming", label: "Upcoming Work" },
  { id: "communications", label: "Communications" },
  { id: "improved", label: "Recently Improved" },
] as const;

/**
 * Premium Mission Control — supervise a living business.
 * Presentation only over composed experience VM.
 */
export default function MissionControlExperience() {
  const viewModel = useContext(MissionControlViewModelContext) as any;
  const experience = (viewModel?.experience ?? null) as Experience | null;
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("briefing");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scope = useOptionalBusinessScope();
  const router = useRouter();

  const businessName = String(
    viewModel?.hero?.businessName
    ?? viewModel?.productContext?.identity?.businessName
    ?? "Your business",
  );

  const showDemo = Array.isArray(viewModel?.demoStorySteps) && viewModel.demoStorySteps.length > 0;

  const sectionCounts = useMemo(() => ({
    waiting: experience?.waitingOnYou?.length ?? 0,
    episodes: experience?.activeBusinessEpisodes?.length ?? 0,
    recommendations: experience?.recommendations?.length ?? 0,
    risks: experience?.risks?.length ?? 0,
    metrics: experience?.criticalMetrics?.length ?? 0,
  }), [experience]);

  async function improve(prompt: string, id: string) {
    if (!scope?.businessId) {
      setError("Open this business workspace to act on recommendations.");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(scope.businessId)}/builder/improve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not open Architect.");
      router.push(data.openHref ?? `/architect/${data.session.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open Architect.");
    } finally {
      setBusyId(null);
    }
  }

  if (!experience) {
    return (
      <div style={{ padding: spacing.lg, color: cockpitColors.textSecondary }}>
        Mission Control experience is still assembling from operating signals.
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100%",
      background: `radial-gradient(900px 420px at 12% -10%, rgba(15,118,110,.10), transparent 55%), ${cockpitColors.background}`,
      padding: `${spacing.lg} ${spacing.md} ${spacing.xl}`,
    }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: spacing.md }}>
        <header style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.accent }}>
            Mission Control
          </div>
          <h1 style={{
            margin: 0,
            fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
            fontSize: "clamp(1.9rem, 3.5vw, 2.6rem)",
            letterSpacing: "-0.02em",
            color: cockpitColors.textPrimary,
            lineHeight: 1.1,
          }}>
            {businessName}
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: cockpitColors.textSecondary, lineHeight: 1.55, fontSize: 16 }}>
            {experience.executiveBriefing?.summary
              ?? "Supervise your living business — evidence first, approval before change."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {experience.businessControlStatus ? (
              <TonePill
                tone={experience.businessControlStatus.tone}
                label={experience.businessControlStatus.label ?? "Operating"}
              />
            ) : null}
            {experience.fabricatedMetricsForbidden ? (
              <span style={quietChip}>Evidence only · no fabricated metrics</span>
            ) : null}
            {experience.businessIntelligence?.observationCounts?.findings != null ? (
              <span style={quietChip}>
                {experience.businessIntelligence.observationCounts.findings} findings
              </span>
            ) : null}
          </div>
        </header>

        {(experience.criticalMetrics?.length ?? 0) > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            {experience.criticalMetrics!.slice(0, 6).map((metric) => (
              <div key={metric.id} style={panel}>
                <div style={{ fontSize: 12, color: cockpitColors.textMuted }}>{metric.label}</div>
                <div style={{ fontSize: "1.45rem", fontWeight: 750, marginTop: 4, color: cockpitColors.textPrimary }}>
                  {metric.value}
                </div>
                {metric.trend ? (
                  <div style={{ fontSize: 12, color: cockpitColors.textSecondary, marginTop: 4 }}>{metric.trend}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {(experience.operatingStates?.length ?? 0) > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(experience.operatingStates!.length, 5)}, minmax(0, 1fr))`, gap: 8 }}>
            {experience.operatingStates!.slice(0, 5).map((state) => (
              <div key={state.id} style={{ ...panel, opacity: Number(state.count ?? 0) === 0 ? 0.55 : 1 }}>
                <div style={{ fontSize: 12, color: cockpitColors.textMuted }}>{state.label ?? state.id}</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{state.count ?? 0}</div>
              </div>
            ))}
          </div>
        ) : null}

        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SECTIONS.map((entry) => {
            const count = (sectionCounts as any)[entry.id];
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSection(entry.id)}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${section === entry.id ? cockpitColors.accent : cockpitColors.panelBorder}`,
                  background: section === entry.id ? "rgba(15,118,110,.08)" : cockpitColors.panel,
                  color: cockpitColors.textPrimary,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: section === entry.id ? 700 : 500,
                  fontSize: typography.caption.fontSize,
                }}
              >
                {entry.label}{typeof count === "number" && count > 0 ? ` · ${count}` : ""}
              </button>
            );
          })}
        </nav>

        {error ? <div style={{ ...panel, color: "#B91C1C" }} role="alert">{error}</div> : null}
        {showDemo ? <DemoStoryMode /> : null}

        {section === "briefing" ? (
          <BriefingPanel experience={experience} onImprove={improve} busyId={busyId} />
        ) : null}
        {section === "waiting" ? (
          <WaitingPanel items={experience.waitingOnYou ?? []} />
        ) : null}
        {section === "episodes" ? (
          <EpisodePanel items={experience.activeBusinessEpisodes ?? []} />
        ) : null}
        {section === "workforce" ? (
          <WorkforcePanel activity={experience.aiWorkforceActivity} />
        ) : null}
        {section === "health" ? (
          <HealthPanel health={experience.businessHealth} />
        ) : null}
        {section === "recommendations" ? (
          <RecommendationPanel
            items={experience.recommendations ?? []}
            busyId={busyId}
            onImprove={improve}
            empty="No evidence-backed recommendations yet."
          />
        ) : null}
        {section === "opportunities" ? (
          <RecommendationPanel
            items={experience.aiOpportunities ?? []}
            busyId={busyId}
            onImprove={improve}
            empty="No AI opportunities with evidence yet."
          />
        ) : null}
        {section === "capacity" ? (
          <RecommendationPanel
            items={experience.capacity ?? []}
            busyId={busyId}
            onImprove={improve}
            empty="Capacity looks steady."
          />
        ) : null}
        {section === "risks" ? (
          <RecommendationPanel
            items={experience.risks ?? []}
            busyId={busyId}
            onImprove={improve}
            empty="No active risks with evidence."
          />
        ) : null}
        {section === "metrics" ? (
          <SimpleRows
            title="Critical Metrics"
            empty="Metrics appear only when evidence exists — nothing is fabricated."
            items={(experience.criticalMetrics ?? []).map((m) => ({
              id: m.id,
              title: m.label,
              detail: `${m.value}${m.trend ? ` · ${m.trend}` : ""}`,
            }))}
          />
        ) : null}
        {section === "timeline" ? (
          <SimpleRows
            title="Business Timeline"
            empty="Activity will appear as your business operates."
            items={(experience.businessTimeline ?? []).map((item, index) => ({
              id: String(item.id ?? index),
              title: String(item.title ?? "Activity"),
              detail: String(item.summary ?? item.occurredAt ?? ""),
            }))}
          />
        ) : null}
        {section === "upcoming" ? (
          <SimpleRows
            title="Upcoming Work"
            empty="No work is moving right now."
            items={(experience.upcomingWork ?? []).map((item, index) => ({
              id: String(item.id ?? index),
              title: String(item.title ?? "Work"),
              detail: String(item.summary ?? item.status ?? ""),
            }))}
          />
        ) : null}
        {section === "communications" ? (
          <CommunicationPanel items={experience.recentCommunications ?? []} />
        ) : null}
        {section === "improved" ? (
          <SimpleRows
            title="Recently Improved"
            empty="Approved improvements will land here after install."
            items={(experience.recentlyImproved ?? []).map((item) => ({
              id: item.id,
              title: item.label,
              detail: item.at ?? "",
            }))}
          />
        ) : null}

        <footer style={{ ...panel, color: cockpitColors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
          {experience.businessIntelligence?.honesty
            ?? "Observe → Analyze → Recommend → Explain → Preview → Dry run → Approve → Install."}
          {" "}
          <Link href={scope?.businessId ? `/b/${scope.businessId}/intelligence` : "/intelligence"} style={{ color: cockpitColors.accent }}>
            Open full Business Intelligence
          </Link>
        </footer>
      </div>
    </div>
  );
}

function BriefingPanel({
  experience,
  onImprove,
  busyId,
}: {
  experience: Experience;
  onImprove: (prompt: string, id: string) => void;
  busyId: string | null;
}) {
  const briefing = experience.executiveBriefing;
  const top = briefing?.topRecommendation;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...panel, background: "linear-gradient(180deg, #fff 0%, #F3F7F6 100%)" }}>
        <h2 style={serifTitle}>{briefing?.headline ?? "Executive Briefing"}</h2>
        <p style={{ margin: "8px 0 0", color: cockpitColors.textSecondary, lineHeight: 1.55, maxWidth: 720 }}>
          {briefing?.summary}
        </p>
        <div style={{ marginTop: 12, color: cockpitColors.textSecondary, fontSize: 13 }}>
          {briefing?.nextHumanStep}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ListCard title="What needs attention" items={briefing?.whatNeedsAttention ?? []} empty="Nothing urgent." />
        <ListCard title="What changed" items={briefing?.whatChanged ?? []} empty="No material changes detected." />
      </div>
      {top ? (
        <div style={panel}>
          <div style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.accent, textTransform: "uppercase" }}>
            Top recommendation
          </div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>{top.title}</div>
          <div style={{ color: cockpitColors.textSecondary, marginTop: 4 }}>{top.reason}</div>
          <button
            type="button"
            disabled={busyId === "top"}
            onClick={() => onImprove(String(top.title), "top")}
            style={primaryButton}
          >
            {busyId === "top" ? "Opening…" : "Preview in Architect"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function WaitingPanel({ items }: { items: NonNullable<Experience["waitingOnYou"]> }) {
  if (!items.length) {
    return <Empty title="Waiting On You" body="Nothing needs your decision right now. VIBETech is handling the rest." />;
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <div key={item.id} style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{item.title}</div>
              <div style={{ color: cockpitColors.textSecondary, marginTop: 4, lineHeight: 1.45 }}>
                {item.summary ?? item.reason}
              </div>
            </div>
            {item.priorityBadge ? <TonePill tone="warning" label={item.priorityBadge} /> : null}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {(item.availableActions ?? []).slice(0, 3).map((action, index) => (
              action.href ? (
                <Link key={`${item.id}_${index}`} href={action.href} style={{ ...ghostButton, textDecoration: "none" }}>
                  {action.label ?? "Open"}
                </Link>
              ) : null
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EpisodePanel({ items }: { items: NonNullable<Experience["activeBusinessEpisodes"]> }) {
  if (!items.length) return <Empty title="Active Business Episodes" body="Episodes appear as real work moves through your business." />;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.slice(0, 8).map((item, index) => (
        <div key={String(item.episodeId ?? index)} style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700 }}>{item.title}</div>
            {item.operatingStateLabel ? <span style={quietChip}>{item.operatingStateLabel}</span> : null}
          </div>
          <div style={{ color: cockpitColors.textSecondary, marginTop: 6, lineHeight: 1.45 }}>{item.summary}</div>
          {item.whatNeedsHumanAttention ? (
            <div style={{ marginTop: 8, fontSize: 13 }}>Needs you: {item.whatNeedsHumanAttention}</div>
          ) : null}
          {item.whatHappensNext ? (
            <div style={{ marginTop: 4, fontSize: 13, color: cockpitColors.textSecondary }}>Next: {item.whatHappensNext}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WorkforcePanel({ activity }: { activity?: Experience["aiWorkforceActivity"] }) {
  const employees = activity?.digitalEmployees ?? [];
  const handled = activity?.handledByVibeTech ?? [];
  if (!employees.length && !handled.length) {
    return <Empty title="AI Workforce Activity" body="Digital employees appear once your Business OS workforce is active." />;
  }
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1.2fr .8fr" }}>
      <div style={{ display: "grid", gap: 10 }}>
        {employees.map((employee) => (
          <div key={employee.id} style={panel}>
            <div style={{ fontWeight: 700 }}>{employee.name ?? "Digital employee"}</div>
            <div style={{ color: cockpitColors.textSecondary, fontSize: 13, marginTop: 4 }}>
              {employee.role ?? employee.status}
            </div>
            {employee.currentHandling ? (
              <div style={{ marginTop: 8 }}>Handling: {employee.currentHandling}</div>
            ) : null}
            {employee.needsFromOwner ? (
              <div style={{ marginTop: 4, color: cockpitColors.textSecondary, fontSize: 13 }}>
                Needs from you: {employee.needsFromOwner}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <SimpleRows
        title="Handled by VIBETech"
        empty="Automatic handling will show here."
        items={handled.map((item, index) => ({
          id: String(item.id ?? index),
          title: String(item.title ?? "Handled"),
          detail: String(item.summary ?? ""),
        }))}
      />
    </div>
  );
}

function HealthPanel({ health }: { health?: Experience["businessHealth"] }) {
  if (!health) return <Empty title="Business Health" body="Health will appear from operating signals." />;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={panel}>
        <h2 style={serifTitle}>Business Health</h2>
        <p style={{ margin: "8px 0 0", color: cockpitColors.textSecondary }}>{health.explanation}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <span style={quietChip}>Status: {health.overallStatus}</span>
          <span style={quietChip}>Score: {health.overallScore ?? "—"}</span>
          <span style={quietChip}>Trend: {health.overallTrend}</span>
          <span style={quietChip}>Confidence: {health.overallConfidence}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ListCard title="Strengths" items={(health.strengths ?? []).map((s) => s.label)} empty="No strengths recorded yet." />
        <ListCard title="Health risks" items={(health.risks ?? []).map((r) => r.label)} empty="No health risks." />
      </div>
    </div>
  );
}

function RecommendationPanel({
  items,
  empty,
  busyId,
  onImprove,
}: {
  items: Array<{
    recommendationId?: string;
    title?: string;
    summary?: string;
    reason?: string;
    confidence?: string;
    businessImpact?: string;
    evidence?: Array<{ label: string }>;
    improvePrompt?: string;
    risk?: string;
    estimatedSavings?: string | null;
  }>;
  empty: string;
  busyId: string | null;
  onImprove: (prompt: string, id: string) => void;
}) {
  if (!items.length) return <Empty title="Nothing here yet" body={empty} />;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item, index) => {
        const id = String(item.recommendationId ?? index);
        return (
          <div key={id} style={panel}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              {item.confidence ? <span style={quietChip}>Confidence: {item.confidence}</span> : null}
              {item.risk ? <span style={quietChip}>Risk: {item.risk}</span> : null}
            </div>
            <div style={{ fontWeight: 700 }}>{item.title}</div>
            <div style={{ color: cockpitColors.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
              {item.summary ?? item.businessImpact ?? item.reason}
            </div>
            {(item.evidence?.length ?? 0) > 0 ? (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: cockpitColors.textSecondary, fontSize: 13 }}>
                {item.evidence!.slice(0, 4).map((ev) => <li key={ev.label}>{ev.label}</li>)}
              </ul>
            ) : null}
            <button
              type="button"
              disabled={busyId === id}
              onClick={() => onImprove(String(item.improvePrompt ?? item.title), id)}
              style={{ ...primaryButton, marginTop: 12 }}
            >
              {busyId === id ? "Opening…" : "Preview in Architect"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CommunicationPanel({ items }: { items: NonNullable<Experience["recentCommunications"]> }) {
  if (!items.length) return <Empty title="Recent Communications" body="Customer and team communications will appear here when evidence exists." />;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <div key={item.id} style={panel}>
          <div style={{ fontWeight: 700 }}>{item.label}</div>
          {item.summary ? <div style={{ color: cockpitColors.textSecondary, marginTop: 4 }}>{item.summary}</div> : null}
          {item.href ? (
            <Link href={item.href} style={{ color: cockpitColors.accent, marginTop: 8, display: "inline-block", fontSize: 13 }}>
              Open thread
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SimpleRows({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; title: string; detail?: string }>;
}) {
  if (!items.length) return <Empty title={title} body={empty} />;
  return (
    <div style={panel}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item) => (
          <div key={item.id}>
            <div style={{ fontWeight: 650 }}>{item.title}</div>
            {item.detail ? <div style={{ color: cockpitColors.textSecondary, fontSize: 13, marginTop: 2 }}>{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ListCard({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div style={panel}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>{title}</h3>
      {items.length === 0 ? (
        <div style={{ color: cockpitColors.textSecondary }}>{empty}</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55, color: cockpitColors.textSecondary }}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div style={panel}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>{body}</p>
    </div>
  );
}

function TonePill({ tone, label }: { tone?: string | null; label: string }) {
  const t = String(tone ?? "neutral");
  const bg = t === "danger" ? "rgba(185,28,28,.1)" : t === "warning" ? "rgba(217,119,6,.12)" : t === "success" ? "rgba(22,163,74,.12)" : cockpitColors.panelElevated;
  const color = t === "danger" ? "#B91C1C" : t === "warning" ? "#B45309" : t === "success" ? "#15803D" : cockpitColors.textSecondary;
  return (
    <span style={{
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 12,
      fontWeight: 700,
      background: bg,
      color,
    }}>
      {label}
    </span>
  );
}

const panel = {
  borderRadius: radius.large,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: cockpitColors.panel,
  padding: spacing.md,
} as const;

const quietChip = {
  borderRadius: 999,
  border: `1px solid ${cockpitColors.panelBorder}`,
  padding: "4px 10px",
  fontSize: 12,
  color: cockpitColors.textSecondary,
  background: cockpitColors.panelElevated ?? cockpitColors.panel,
} as const;

const serifTitle = {
  margin: 0,
  fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  fontSize: "1.35rem",
  color: cockpitColors.textPrimary,
} as const;

const primaryButton = {
  borderRadius: radius.medium,
  border: "none",
  background: "#0F766E",
  color: "#fff",
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 650,
  marginTop: 12,
} as const;

const ghostButton = {
  borderRadius: radius.medium,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: "transparent",
  color: cockpitColors.textPrimary,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
} as const;
