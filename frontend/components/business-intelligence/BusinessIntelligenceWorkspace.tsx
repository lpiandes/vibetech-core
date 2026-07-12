"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type GovernedRecommendation = {
  recommendationId: string;
  title: string;
  summary?: string;
  reason: string;
  evidence: Array<{ evidenceId?: string; label: string; source?: string; detail?: string | null }>;
  confidence: string;
  businessImpact: string;
  affectedDepartments: string[];
  affectedEmployees: string[];
  estimatedSavings?: string | null;
  risk: string;
  requiredApprovals: string[];
  reuse?: {
    strategy: string;
    assetLabel?: string | null;
    explanation?: string;
    isGap?: boolean;
  };
  category?: string;
  priority?: string;
  improvePrompt?: string;
  pipeline?: string[];
  nextStep?: string;
};

type BIView = {
  businessId?: string | null;
  businessName?: string | null;
  generatedAt?: string;
  honesty?: { message?: string };
  executiveBriefing?: {
    headline?: string;
    summary?: string;
    whatChanged?: string[];
    whatNeedsAttention?: string[];
    topRecommendation?: { title?: string; reason?: string; confidence?: string } | null;
    nextHumanStep?: string;
  };
  recommendations?: GovernedRecommendation[];
  opportunities?: GovernedRecommendation[];
  businessHealth?: {
    overallScore?: number | null;
    overallStatus?: string;
    overallTrend?: string;
    overallConfidence?: string;
    explanation?: string;
    strengths?: Array<{ id: string; label: string; reason?: string }>;
    risks?: Array<{ id: string; label: string; reason?: string; priority?: string }>;
    dimensions?: Array<{ id: string; label: string; score?: number | null; explanation?: string }>;
  };
  risks?: GovernedRecommendation[];
  capacity?: GovernedRecommendation[];
  aiSuggestions?: GovernedRecommendation[];
  recentImprovements?: Array<{ id: string; label: string; at?: string | null }>;
  futureRoadmap?: Array<{ id: string; label: string; items: Array<{ recommendationId: string; title: string; reuseStrategy?: string | null; risk?: string }> }>;
  pipeline?: string[];
  observationCounts?: Record<string, number>;
  intelligenceCandidates?: IntelligenceCandidateCard[];
};

type IntelligenceCandidateCard = {
  id: string;
  title: string;
  summary?: string;
  explanation?: string;
  whatHappened?: string;
  whyItMatters?: string;
  severity?: string;
  confidenceReason?: string;
  status?: string;
  ownerRef?: { id?: string; kind?: string } | null;
  evidence?: Array<{ objectType: string; objectId: string; explanation: string }>;
  missingEvidence?: string[];
  recommendedActions?: Array<{ actionId: string; kind: string; label: string }>;
  relatedObjectRefs?: Array<{ objectType: string; objectId: string }>;
};

const SECTIONS = [
  { id: "attention", label: "Needs Attention" },
  { id: "executive", label: "Executive Briefing" },
  { id: "recommendations", label: "Recommendations" },
  { id: "opportunities", label: "Opportunities" },
  { id: "health", label: "Business Health" },
  { id: "risks", label: "Risks" },
  { id: "capacity", label: "Capacity" },
  { id: "ai", label: "AI Suggestions" },
  { id: "improvements", label: "Recent Improvements" },
  { id: "roadmap", label: "Future Roadmap" },
] as const;

/**
 * Business Intelligence workspace — continuous understanding after install.
 * Presentation only. Improve actions open Architect governed flow.
 */
export default function BusinessIntelligenceWorkspace({ view }: { view: BIView }) {
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("attention");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState(view.intelligenceCandidates ?? []);
  const scope = useBusinessScope();
  const router = useRouter();
  const businessId = view.businessId ?? scope.businessId;

  async function refreshIntelligence() {
    setBusyId("refresh");
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/intelligence/candidates`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not evaluate intelligence.");
      setCandidates(data.candidates ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not evaluate intelligence.");
    } finally {
      setBusyId(null);
    }
  }

  async function candidateAction(
    candidateId: string,
    action: "create-work" | "dismiss" | "propose-change",
    body: Record<string, unknown> = {},
  ) {
    setBusyId(candidateId + action);
    setError(null);
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/intelligence/candidates/${encodeURIComponent(candidateId)}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.message ?? "Action failed.");
      if (action === "propose-change" && data.openHref) {
        router.push(data.openHref);
        return;
      }
      await refreshIntelligence();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function askArchitect(candidate: IntelligenceCandidateCard) {
    setBusyId(candidate.id);
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/builder/improve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: `What needs attention about: ${candidate.title}? Explain evidence only.`,
          intelligenceCandidateId: candidate.id,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.message ?? "Could not open Architect.");
      router.push(data.openHref ?? `/b/${businessId}/architect?intelligenceCandidateId=${encodeURIComponent(candidate.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open Architect.");
    } finally {
      setBusyId(null);
    }
  }

  async function startImprove(recommendation: GovernedRecommendation) {
    setBusyId(recommendation.recommendationId);
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/builder/improve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: recommendation.improvePrompt ?? recommendation.title,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.message ?? "Could not open Architect.");
      router.push(data.openHref ?? `/architect/${data.session.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open Architect.");
    } finally {
      setBusyId(null);
    }
  }

  const listForSection = (): GovernedRecommendation[] => {
    if (section === "recommendations") return view.recommendations ?? [];
    if (section === "opportunities") return view.opportunities ?? [];
    if (section === "risks") return view.risks ?? [];
    if (section === "capacity") return view.capacity ?? [];
    if (section === "ai") return view.aiSuggestions ?? [];
    return [];
  };

  return (
    <div style={{ display: "grid", gap: spacing.md, padding: spacing.md }}>
      <header style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: cockpitColors.accent }}>
          Business Intelligence
        </div>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, color: cockpitColors.textPrimary }}>
          {view.businessName ?? "Your business"} — continuous understanding
        </h1>
        <p style={{ margin: 0, color: cockpitColors.textSecondary, maxWidth: 720, lineHeight: 1.5 }}>
          {view.honesty?.message
            ?? "Observe → Analyze → Recommend → Explain → Preview → Dry run → Approve → Install. Nothing changes silently."}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {view.pipeline?.length ? view.pipeline.map((step) => (
            <span key={step} style={chipStyle}>{humanize(step)}</span>
          )) : null}
          <button type="button" onClick={() => void refreshIntelligence()} style={chipStyle} disabled={busyId === "refresh"}>
            {busyId === "refresh" ? "Evaluating…" : "Refresh intelligence"}
          </button>
        </div>
      </header>

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {SECTIONS.map((entry) => (
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
            {entry.label}
          </button>
        ))}
      </nav>

      {error ? (
        <div style={{ ...panelStyle, color: "#B91C1C" }} role="alert">{error}</div>
      ) : null}

      {section === "attention" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {candidates.length === 0 ? (
            <div style={{ ...panelStyle, color: cockpitColors.textSecondary }}>
              No intelligence candidates yet. Refresh to evaluate canonical evidence.
            </div>
          ) : (
            candidates.map((candidate) => (
              <IntelligenceCandidateCardView
                key={candidate.id}
                candidate={candidate}
                expanded={expandedId === candidate.id}
                busy={Boolean(busyId?.startsWith(candidate.id))}
                onToggle={() => setExpandedId((current) => (current === candidate.id ? null : candidate.id))}
                onCreateWork={() => void candidateAction(candidate.id, "create-work")}
                onProposeChange={() => void candidateAction(candidate.id, "propose-change")}
                onDismiss={() => void candidateAction(candidate.id, "dismiss", { reason: "Dismissed from Needs Attention" })}
                onAskArchitect={() => void askArchitect(candidate)}
              />
            ))
          )}
        </div>
      ) : null}

      {section === "executive" ? (
        <ExecutiveBriefingPanel briefing={view.executiveBriefing} health={view.businessHealth} counts={view.observationCounts} />
      ) : null}

      {section === "health" ? (
        <HealthPanel health={view.businessHealth} />
      ) : null}

      {section === "improvements" ? (
        <SimpleList
          title="Recent Improvements"
          empty="Improvements you approve and install will appear here."
          items={(view.recentImprovements ?? []).map((item) => ({ id: item.id, label: item.label, detail: item.at }))}
        />
      ) : null}

      {section === "roadmap" ? (
        <RoadmapPanel roadmap={view.futureRoadmap ?? []} />
      ) : null}

      {["recommendations", "opportunities", "risks", "capacity", "ai"].includes(section) ? (
        <div style={{ display: "grid", gap: 12 }}>
          {listForSection().length === 0 ? (
            <div style={{ ...panelStyle, color: cockpitColors.textSecondary }}>
              Nothing in this section right now — evidence is still forming.
            </div>
          ) : (
            listForSection().map((recommendation) => (
              <RecommendationCard
                key={recommendation.recommendationId}
                recommendation={recommendation}
                expanded={expandedId === recommendation.recommendationId}
                busy={busyId === recommendation.recommendationId}
                onToggle={() => setExpandedId((current) =>
                  current === recommendation.recommendationId ? null : recommendation.recommendationId)}
                onImprove={() => void startImprove(recommendation)}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function IntelligenceCandidateCardView({
  candidate,
  expanded,
  busy,
  onToggle,
  onCreateWork,
  onProposeChange,
  onDismiss,
  onAskArchitect,
}: {
  candidate: IntelligenceCandidateCard;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onCreateWork: () => void;
  onProposeChange: () => void;
  onDismiss: () => void;
  onAskArchitect: () => void;
}) {
  return (
    <article style={panelStyle}>
      <button type="button" onClick={onToggle} style={{ all: "unset", cursor: "pointer", display: "grid", gap: 6, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ color: cockpitColors.textPrimary }}>{candidate.title}</strong>
          <span style={chipStyle}>{candidate.severity ?? "medium"} · {candidate.status ?? "open"}</span>
        </div>
        <div style={{ color: cockpitColors.textSecondary }}>{candidate.whatHappened ?? candidate.summary}</div>
      </button>
      {expanded ? (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div><strong>Why it matters</strong><div style={{ color: cockpitColors.textSecondary }}>{candidate.whyItMatters ?? candidate.explanation}</div></div>
          <div><strong>Confidence</strong><div style={{ color: cockpitColors.textSecondary }}>{candidate.confidenceReason}</div></div>
          <div><strong>Owner</strong><div style={{ color: cockpitColors.textSecondary }}>{candidate.ownerRef?.id ?? "unassigned"}</div></div>
          <div>
            <strong>Evidence</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {(candidate.evidence ?? []).map((entry) => (
                <li key={`${entry.objectType}:${entry.objectId}`}>{entry.objectType}:{entry.objectId} — {entry.explanation}</li>
              ))}
            </ul>
            {(candidate.missingEvidence ?? []).length ? (
              <div style={{ color: "#B45309", marginTop: 6 }}>Missing: {(candidate.missingEvidence ?? []).join(", ")}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={onCreateWork} style={chipStyle}>Create Work</button>
            <button type="button" disabled={busy} onClick={onProposeChange} style={chipStyle}>Propose Change</button>
            <button type="button" disabled={busy} onClick={onAskArchitect} style={chipStyle}>Ask Architect</button>
            <button type="button" disabled={busy} onClick={onDismiss} style={chipStyle}>Dismiss</button>
            {(candidate.relatedObjectRefs ?? []).slice(0, 3).map((ref) => (
              <a key={`${ref.objectType}:${ref.objectId}`} href={`/${ref.objectType}/${ref.objectId}`} style={chipStyle}>
                Open {ref.objectType}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ExecutiveBriefingPanel({
  briefing,
  health,
  counts,
}: {
  briefing?: BIView["executiveBriefing"];
  health?: BIView["businessHealth"];
  counts?: Record<string, number>;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={panelStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem" }}>{briefing?.headline ?? "Executive briefing"}</h2>
        <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>{briefing?.summary}</p>
        <div style={{ marginTop: 12, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
          {briefing?.nextHumanStep}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        <Stat label="Findings" value={counts?.findings ?? 0} />
        <Stat label="Health" value={health?.overallStatus ?? "—"} />
        <Stat label="Score" value={health?.overallScore ?? "—"} />
        <Stat label="Trend" value={humanize(health?.overallTrend ?? "—")} />
      </div>
      <TwoColumn
        leftTitle="What needs attention"
        leftItems={briefing?.whatNeedsAttention ?? []}
        rightTitle="What changed"
        rightItems={briefing?.whatChanged ?? []}
      />
      {briefing?.topRecommendation ? (
        <div style={panelStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.accent, textTransform: "uppercase" }}>Top recommendation</div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>{briefing.topRecommendation.title}</div>
          <div style={{ color: cockpitColors.textSecondary, marginTop: 4 }}>{briefing.topRecommendation.reason}</div>
          <div style={{ marginTop: 8, fontSize: 13 }}>Confidence: {briefing.topRecommendation.confidence}</div>
        </div>
      ) : null}
    </div>
  );
}

function HealthPanel({ health }: { health?: BIView["businessHealth"] }) {
  if (!health) {
    return <div style={panelStyle}>Business health is not available yet.</div>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={panelStyle}>
        <h2 style={{ margin: "0 0 8px" }}>Business Health</h2>
        <p style={{ margin: 0, color: cockpitColors.textSecondary }}>{health.explanation}</p>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={chipStyle}>Status: {health.overallStatus}</span>
          <span style={chipStyle}>Score: {health.overallScore ?? "—"}</span>
          <span style={chipStyle}>Trend: {humanize(health.overallTrend ?? "")}</span>
          <span style={chipStyle}>Confidence: {health.overallConfidence}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SimpleList
          title="Strengths"
          empty="No strengths recorded yet."
          items={(health.strengths ?? []).map((item) => ({ id: item.id, label: item.label, detail: item.reason }))}
        />
        <SimpleList
          title="Health risks"
          empty="No health risks recorded."
          items={(health.risks ?? []).map((item) => ({ id: item.id, label: item.label, detail: item.reason }))}
        />
      </div>
      {(health.dimensions ?? []).length ? (
        <div style={panelStyle}>
          <h3 style={{ marginTop: 0 }}>Dimensions</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {health.dimensions!.map((dimension) => (
              <div key={dimension.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 650 }}>{dimension.label}</div>
                  <div style={{ color: cockpitColors.textSecondary, fontSize: 13 }}>{dimension.explanation}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{dimension.score ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecommendationCard({
  recommendation,
  expanded,
  busy,
  onToggle,
  onImprove,
}: {
  recommendation: GovernedRecommendation;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onImprove: () => void;
}) {
  return (
    <article style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={chipStyle}>{humanize(recommendation.priority ?? "soon")}</span>
            <span style={chipStyle}>Risk: {recommendation.risk}</span>
            <span style={chipStyle}>Confidence: {recommendation.confidence}</span>
            {recommendation.reuse?.strategy ? (
              <span style={chipStyle}>Reuse: {humanize(recommendation.reuse.strategy)}</span>
            ) : null}
          </div>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{recommendation.title}</h3>
          <p style={{ margin: "8px 0 0", color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
            {recommendation.summary ?? recommendation.businessImpact}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <button type="button" onClick={onToggle} style={ghostButton}>
            {expanded ? "Hide evidence" : "Explain"}
          </button>
          <button type="button" onClick={onImprove} disabled={busy} style={primaryButton}>
            {busy ? "Opening…" : "Preview in Architect"}
          </button>
        </div>
      </div>

      {expanded ? (
        <div style={{ marginTop: 14, display: "grid", gap: 10, borderTop: `1px solid ${cockpitColors.panelBorder}`, paddingTop: 14 }}>
          <Field label="Reason" value={recommendation.reason} />
          <Field label="Business impact" value={recommendation.businessImpact} />
          {recommendation.estimatedSavings ? <Field label="Estimated savings" value={recommendation.estimatedSavings} /> : null}
          <Field label="Affected departments" value={(recommendation.affectedDepartments ?? []).join(", ") || "—"} />
          <Field label="Affected employees" value={(recommendation.affectedEmployees ?? []).join(", ") || "—"} />
          <Field label="Required approvals" value={(recommendation.requiredApprovals ?? []).join(", ") || "owner"} />
          {recommendation.reuse?.explanation ? <Field label="Reuse path" value={recommendation.reuse.explanation} /> : null}
          <div>
            <div style={{ fontWeight: 650, marginBottom: 6 }}>Evidence</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
              {(recommendation.evidence ?? []).map((item) => (
                <li key={item.evidenceId ?? item.label}>{item.label}</li>
              ))}
            </ul>
          </div>
          <div style={{ fontSize: 13, color: cockpitColors.textSecondary }}>
            Next: {humanize(recommendation.nextStep ?? "explain")} — never installs without approval.
          </div>
        </div>
      ) : null}
    </article>
  );
}

function RoadmapPanel({
  roadmap,
}: {
  roadmap: Array<{ id: string; label: string; items: Array<{ recommendationId: string; title: string; reuseStrategy?: string | null }> }>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
      {roadmap.map((tier) => (
        <div key={tier.id} style={panelStyle}>
          <h3 style={{ marginTop: 0 }}>{tier.label}</h3>
          {tier.items.length === 0 ? (
            <div style={{ color: cockpitColors.textSecondary }}>Nothing scheduled.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
              {tier.items.map((item) => (
                <li key={item.recommendationId}>
                  {item.title}
                  {item.reuseStrategy ? (
                    <div style={{ color: cockpitColors.textSecondary, fontSize: 12 }}>{humanize(item.reuseStrategy)}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function SimpleList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; label: string; detail?: string | null }>;
}) {
  return (
    <div style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {items.length === 0 ? (
        <div style={{ color: cockpitColors.textSecondary }}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <div key={item.id}>
              <div style={{ fontWeight: 650 }}>{item.label}</div>
              {item.detail ? <div style={{ color: cockpitColors.textSecondary, fontSize: 13 }}>{item.detail}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TwoColumn({
  leftTitle,
  leftItems,
  rightTitle,
  rightItems,
}: {
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <SimpleList title={leftTitle} empty="Nothing urgent." items={leftItems.map((label, index) => ({ id: `${index}`, label }))} />
      <SimpleList title={rightTitle} empty="No material changes detected." items={rightItems.map((label, index) => ({ id: `${index}`, label }))} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 12, color: cockpitColors.textSecondary }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 750, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontWeight: 650 }}>{label}</div>
      <div style={{ color: cockpitColors.textSecondary, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function humanize(value: string) {
  return String(value ?? "").replace(/_/g, " ");
}

const panelStyle = {
  borderRadius: radius.large,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: cockpitColors.panel,
  padding: spacing.md,
} as const;

const chipStyle = {
  borderRadius: 999,
  border: `1px solid ${cockpitColors.panelBorder}`,
  padding: "4px 10px",
  fontSize: 12,
  color: cockpitColors.textSecondary,
  background: cockpitColors.panelElevated ?? cockpitColors.panel,
} as const;

const ghostButton = {
  borderRadius: radius.medium,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: "transparent",
  color: cockpitColors.textPrimary,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
} as const;

const primaryButton = {
  borderRadius: radius.medium,
  border: "none",
  background: "#0F766E",
  color: "#fff",
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 650,
} as const;
