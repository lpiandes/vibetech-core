import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Compose Mission Control experience from existing view models.
 * No new engines — presentation/composition only.
 */
export function composeMissionControlExperience({
  missionControlViewModel,
  businessIntelligenceView = null,
  recentCommunications = [],
  upcomingWork = null,
} = {}) {
  if (!missionControlViewModel || typeof missionControlViewModel !== "object") {
    throw new Error("composeMissionControlExperience: missionControlViewModel required.");
  }

  const bi = businessIntelligenceView && typeof businessIntelligenceView === "object"
    ? businessIntelligenceView
    : null;

  const pulse = asArray(missionControlViewModel.pulse);
  const criticalMetrics = pulse
    .filter((metric) => metricAvailable(metric))
    .map((metric) => deepFreeze({
      id: String(metric.id ?? metric.label),
      label: String(metric.label ?? metric.id ?? "Metric"),
      value: metric.value,
      trend: metric.trend == null ? null : String(metric.trend),
      evidence: metric.evidence == null ? null : String(metric.evidence),
    }));

  const executiveBriefing = bi?.executiveBriefing
    ? deepFreeze({ ...bi.executiveBriefing })
    : deepFreeze({
        headline: String(
          missionControlViewModel.hero?.headline
          ?? missionControlViewModel.headline
          ?? missionControlViewModel.hero?.businessName
          ?? "Mission Control",
        ),
        summary: String(
          missionControlViewModel.hero?.summary
          ?? missionControlViewModel.subheadline
          ?? missionControlViewModel.businessStateSummary
          ?? "Your operating system is ready for supervision.",
        ),
        whatChanged: [],
        whatNeedsAttention: asArray(missionControlViewModel.needsYourAttention)
          .slice(0, 3)
          .map((item) => String(item.title ?? item.summary ?? item.id)),
        topRecommendation: null,
        nextHumanStep: String(
          missionControlViewModel.whatHappensNext
          ?? "Review Waiting On You, then approve only what needs a human.",
        ),
      });

  const businessHealth = bi?.businessHealth
    ? deepFreeze({ ...bi.businessHealth })
    : deepFreeze({
        overallScore: typeof missionControlViewModel.hero?.score === "number"
          ? missionControlViewModel.hero.score
          : null,
        overallStatus: String(
          missionControlViewModel.businessControlStatus?.label
          ?? missionControlViewModel.overallStatus
          ?? "unknown",
        ),
        overallTrend: "stable",
        overallConfidence: "medium",
        strengths: [],
        risks: [],
        dimensions: [],
        explanation: String(
          missionControlViewModel.businessControlStatus?.reason
          ?? "Health is derived from operating signals — never fabricated.",
        ),
      });

  const experience = deepFreeze({
    contract: "MissionControlExperience/v1",
    mutatesBusinessOs: false,
    fabricatedMetricsForbidden: true,
    opaqueAiForbidden: true,
    adaptsToInstalledOs: true,
    executiveBriefing,
    businessIntelligence: deepFreeze({
      observationCounts: bi?.observationCounts ?? {},
      pipeline: bi?.pipeline ?? [
        "observe", "analyze", "recommend", "explain", "preview", "dry_run", "approve", "install",
      ],
      honesty: bi?.honesty?.message
        ?? "Every recommendation includes evidence. Nothing changes until you approve.",
    }),
    businessHealth,
    aiWorkforceActivity: deepFreeze({
      digitalEmployees: asArray(missionControlViewModel.digitalWorkforce?.digitalEmployees),
      humanTeamSummary: missionControlViewModel.digitalWorkforce?.humanTeamSummary ?? null,
      handledByVibeTech: asArray(missionControlViewModel.handledByVibeTech),
    }),
    activeBusinessEpisodes: Object.freeze(
      asArray(missionControlViewModel.businessEpisodeFeed?.length
        ? missionControlViewModel.businessEpisodeFeed
        : missionControlViewModel.businessEpisodes),
    ),
    waitingOnYou: Object.freeze(asArray(missionControlViewModel.needsYourAttention)),
    aiOpportunities: Object.freeze(
      asArray(bi?.opportunities?.length ? bi.opportunities : bi?.aiSuggestions),
    ),
    businessTimeline: Object.freeze(asArray(missionControlViewModel.businessActivity)),
    capacity: Object.freeze(asArray(bi?.capacity)),
    risks: Object.freeze(
      asArray(bi?.risks?.length
        ? bi.risks
        : asArray(businessHealth.risks).map((risk) => ({
            recommendationId: String(risk.id),
            title: String(risk.label ?? risk.id),
            reason: String(risk.reason ?? ""),
            evidence: [{ label: String(risk.reason ?? risk.label ?? "Health risk") }],
            confidence: "medium",
            businessImpact: String(risk.reason ?? risk.label ?? ""),
            risk: String(risk.priority ?? "medium").toLowerCase() === "high" ? "high" : "medium",
            requiredApprovals: ["owner"],
            affectedDepartments: ["Leadership"],
            affectedEmployees: ["Owner"],
          }))),
    ),
    recommendations: Object.freeze(asArray(bi?.recommendations)),
    recentlyImproved: Object.freeze(asArray(bi?.recentImprovements)),
    upcomingWork: Object.freeze(
      asArray(
        upcomingWork
        ?? missionControlViewModel.workMovingNow
        ?? missionControlViewModel.workInProgress,
      ),
    ),
    recentCommunications: Object.freeze(asArray(recentCommunications).map(normalizeCommunication)),
    criticalMetrics: Object.freeze(criticalMetrics),
    operatingStates: Object.freeze(asArray(missionControlViewModel.operatingStates)),
    businessControlStatus: missionControlViewModel.businessControlStatus
      ? deepFreeze({ ...missionControlViewModel.businessControlStatus })
      : null,
    futureRoadmap: Object.freeze(asArray(bi?.futureRoadmap)),
  });

  return {
    ...missionControlViewModel,
    experience,
    // Prefer BI health over empty command-center health array when present.
    businessHealth: Array.isArray(missionControlViewModel.businessHealth)
      && missionControlViewModel.businessHealth.length === 0
      && bi?.businessHealth
      ? [businessHealth]
      : missionControlViewModel.businessHealth,
    executiveBriefing,
    intelligence: bi,
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function metricAvailable(metric) {
  if (!metric || typeof metric !== "object") return false;
  if (metric.availability && String(metric.availability).toLowerCase() === "unavailable") return false;
  if (metric.value == null) return false;
  const value = String(metric.value).trim();
  if (!value || value === "—" || value.toLowerCase() === "n/a") return false;
  return true;
}

function normalizeCommunication(entry) {
  if (typeof entry === "string") {
    return deepFreeze({ id: entry, label: entry, summary: null, at: null, href: null });
  }
  return deepFreeze({
    id: String(entry.id ?? entry.threadId ?? entry.label ?? "comm"),
    label: String(entry.label ?? entry.title ?? entry.subject ?? "Communication"),
    summary: entry.summary == null && entry.preview == null
      ? null
      : String(entry.summary ?? entry.preview),
    at: entry.at == null && entry.occurredAt == null ? null : String(entry.at ?? entry.occurredAt),
    href: entry.href == null ? null : String(entry.href),
  });
}
