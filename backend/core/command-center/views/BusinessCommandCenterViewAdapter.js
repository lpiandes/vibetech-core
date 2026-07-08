import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function mapOperationalStatusToHero(status) {
  if (status === "needs_attention") return { label: "Needs you", tone: "warning" };
  if (status === "setup_in_progress") return { label: "Setup", tone: "neutral" };
  return { label: "Operating", tone: "success" };
}

function mapBusinessControlTone(status) {
  if (status === "NEEDS_YOUR_ATTENTION") return "warning";
  if (status === "AT_RISK") return "danger";
  if (status === "SETUP_INCOMPLETE") return "neutral";
  return "success";
}

function mapPriorityToBadge(priority) {
  const p = String(priority ?? "medium").toLowerCase();
  if (p === "critical") return "critical";
  if (p === "high") return "warning";
  return "neutral";
}

export function adaptBusinessCommandCenterView(commandCenter, { pageLabels } = {}) {
  const cc = commandCenter ?? {};
  const heroStatus = mapOperationalStatusToHero(cc.hero?.operationalStatus);
  const control = cc.businessControlStatus ?? {};

  return deepFreeze({
    viewId: "business_command_center",
    layout: "operating_cockpit",
    pageTitle: pageLabels?.commandCenter ?? "Home",
    hero: deepFreeze({
      businessName: cc.hero?.businessName ?? "",
      operatingSystemTitle: cc.hero?.operatingSystemTitle ?? "",
      statusLabel: heroStatus.label,
      statusTone: heroStatus.tone,
      headline: cc.hero?.headline ?? cc.businessStateSummary?.headline ?? "",
      summary: cc.hero?.summary ?? cc.businessStateSummary?.summary ?? "",
      currentTimeContext: cc.hero?.currentTimeContext ?? null,
    }),
    businessStateSummary: cc.businessStateSummary ?? null,
    businessControlStatus: deepFreeze({
      status: control.status ?? "UNDER_CONTROL",
      label: control.label ?? "Under control",
      reason: control.reason ?? "",
      tone: mapBusinessControlTone(control.status),
      activeEpisodes: control.activeEpisodes ?? 0,
    }),
    operatingStates: deepFreeze(safeArray(cc.operatingStates?.states)),
    pulse: deepFreeze(safeArray(cc.pulse).map((m) => ({
      id: m.id,
      label: m.label,
      value: m.value,
      trend: m.trend,
    }))),
    needsYourAttention: deepFreeze(
      safeArray(cc.needsYourAttention).map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        reason: item.reason,
        businessImpact: item.businessImpact,
        priority: item.priority,
        priorityBadge: mapPriorityToBadge(item.priority),
        dueAt: item.dueAt,
        waitingDuration: item.waitingDuration ?? null,
        partyId: item.partyId ?? null,
        partyName: item.partyName ?? null,
        subjectName: item.subjectName ?? null,
        approvalId: item.approvalId ?? item.sourceId ?? null,
        recommendedAction: item.recommendedAction,
        availableActions: item.availableActions,
        relatedObjects: item.relatedObjects,
      })),
    ),
    handledByVibeTech: deepFreeze(safeArray(cc.handledByVibeTech)),
    workInProgress: cc.workInProgress ?? { in_progress: [], waiting: [], blocked: [] },
    workMovingNow: deepFreeze(safeArray(cc.workMovingNow)),
    businessEpisodes: deepFreeze(safeArray(cc.businessEpisodes)),
    businessEpisodeFeed: deepFreeze(safeArray(cc.businessEpisodeFeed)),
    digitalWorkforce: cc.digitalWorkforce ?? { digitalEmployees: [], humanTeamSummary: {} },
    businessActivity: deepFreeze(safeArray(cc.businessActivity)),
    businessHealth: deepFreeze(safeArray(cc.businessHealth)),
    whatHappensNext: deepFreeze(safeArray(cc.whatHappensNext)),
    autonomousContinuation: deepFreeze(safeArray(cc.autonomousContinuation)),
    autonomousContinuationTitle: pageLabels?.autonomousContinuation ?? "VIBETech will keep moving",
    workspaceSignals: deepFreeze(safeArray(cc.workspaceSignals)),
  });
}
