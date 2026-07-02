import { createCompanyBriefSection } from "./CompanyBriefSection.js";
import { createCompanyBriefAction } from "./CompanyBriefAction.js";
import { createCompanyBrief } from "./CompanyBrief.js";
import { COMPANY_BRIEF_VERSION, SECTION_IDS, SECTION_ORDER, greetingForNowISO } from "./CompanyBriefDefaults.js";
import { validateCompanyBrief } from "./CompanyBriefValidator.js";
import { BusinessCapabilityEngine } from "../../capabilities/engine/BusinessCapabilityEngine.js";
import { COMPANY_EVENT_TYPES } from "../../company/events/CompanyEventTypes.js";

function stableIdPart(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

function listActiveKnowledgeCount(knowledgeRepository) {
  const repo = knowledgeRepository ?? { items: [] };
  const items = Array.isArray(repo.items) ? repo.items : [];
  return items.filter((i) => i && i.status !== "ARCHIVED").length;
}

function disconnectedSystemsFromConnectedSystems(connectedSystems) {
  const cs = connectedSystems ?? [];
  const items = Array.isArray(cs) ? cs : [];
  return items.filter((s) => s && String(s.status) !== "READY");
}

function failedCommunicationsCountFromActivities(activities) {
  const list = Array.isArray(activities) ? activities : [];
  // Prefer reading failures from Communications state; fallback to activities.
  const failedByCommStatus = list.filter(Boolean).length; // placeholder; handled elsewhere
  void failedByCommStatus;

  const failedFromActions = list.filter(
    (a) =>
      a &&
      typeof a === "object" &&
      typeof a.action === "string" &&
      (a.action === COMPANY_EVENT_TYPES.KNOWLEDGE_PUBLISH_FAILED ||
        a.action === COMPANY_EVENT_TYPES.KNOWLEDGE_INGESTION_FAILED),
  );
  // Knowledge publish/ingest failures are handled separately from communications failures.
  void failedFromActions;
  return 0;
}

function communicationsToCompute(companyRuntime) {
  const communications = companyRuntime.getCommunications?.() ?? [];
  const commList = Array.isArray(communications) ? communications : [];
  const failed = commList.filter((c) => c?.status === "FAILED").length;
  const pendingApproval = commList.filter((c) => c?.status === "PENDING_APPROVAL").length;
  return { failed, pendingApproval, total: commList.length };
}

function knowledgeFailuresFromActivities(activities) {
  const list = Array.isArray(activities) ? activities : [];
  const hasPublishFailed = list.some((a) => a?.action === COMPANY_EVENT_TYPES.KNOWLEDGE_PUBLISH_FAILED);
  const hasIngestionFailed = list.some((a) => a?.action === COMPANY_EVENT_TYPES.KNOWLEDGE_INGESTION_FAILED);
  const count = list.filter(
    (a) => a?.action === COMPANY_EVENT_TYPES.KNOWLEDGE_PUBLISH_FAILED || a?.action === COMPANY_EVENT_TYPES.KNOWLEDGE_INGESTION_FAILED,
  ).length;
  return { hasPublishFailed, hasIngestionFailed, count };
}

function workforceStateFromEmployees(employees) {
  const list = Array.isArray(employees) ? employees : [];
  const offlineCount = list.filter((e) => e?.status === "Offline").length;
  const needingReviewCount = list.filter((e) => (e?.currentWorkload?.waitingOnYouCount ?? 0) > 0).length;
  if (offlineCount === list.length && list.length > 0) return "Offline";
  if (needingReviewCount > 0) return "Needs Review";
  return "Employees Working";
}

function computeLatestActivityISO(activities) {
  const list = Array.isArray(activities) ? activities : [];
  const timestamps = list.map((a) => a?.timestampISO).filter(Boolean);
  if (!timestamps.length) return null;
  const max = timestamps
    .map((t) => new Date(t).getTime())
    .filter((n) => Number.isFinite(n))
    .reduce((acc, n) => Math.max(acc, n), 0);
  if (!max) return null;
  return new Date(max).toISOString();
}

function sortActivitiesDesc(activities) {
  const list = Array.isArray(activities) ? activities : [];
  return [...list].sort((a, b) => {
    const at = new Date(a?.timestampISO ?? 0).getTime();
    const bt = new Date(b?.timestampISO ?? 0).getTime();
    return bt - at || String(a?.action ?? "").localeCompare(String(b?.action ?? ""));
  });
}

function buildRisk({
  id,
  label,
  status,
  priority,
  summary,
  metadata,
} = {}) {
  return deepFreeze({
    id: String(id),
    label: String(label ?? id),
    status: String(status ?? "ACTIVE"),
    priority: String(priority ?? "MEDIUM"),
    summary: String(summary ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

function buildOpportunity({
  id,
  label,
  status,
  priority,
  summary,
  metadata,
} = {}) {
  return deepFreeze({
    id: String(id),
    label: String(label ?? id),
    status: String(status ?? "OPEN"),
    priority: String(priority ?? "MEDIUM"),
    summary: String(summary ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

function priorityOrderingIndexForId(priorityId) {
  const rank = [
    "priority_review_work_queue",
    "priority_blocked_work",
    "priority_failed_communications",
    "priority_disconnected_systems",
    "priority_knowledge_issues",
    "priority_capability_readiness_gaps",
    "priority_urgent_work_queue_items",
  ];
  const idx = rank.indexOf(priorityId);
  return idx >= 0 ? idx : 99;
}

export function buildCompanyBrief({
  companyRuntime,
  nowISO,
  businessCapabilityEngine,
} = {}) {
  if (!companyRuntime) throw new Error("CompanyBriefBuilder: companyRuntime required.");
  const clockISO = typeof nowISO === "string" ? new Date(nowISO).toISOString() : "2026-07-01T00:00:00.000Z";

  const company = companyRuntime.getCompany?.() ?? {};
  const companyId = String(company.companyName ?? "company");

  const briefId = `brief_${stableIdPart(companyId)}_${stableIdPart(clockISO)}`;
  const greeting = greetingForNowISO();

  const employees = companyRuntime.getEmployees?.() ?? [];
  const workforceState = workforceStateFromEmployees(employees);

  const metrics = companyRuntime.getMetrics?.() ?? {};
  const pendingReviews = Number(metrics.pendingReviews ?? 0);
  const completedToday = Number(metrics.completedToday ?? 0);
  const hoursSavedToday = Number(metrics.hoursSavedToday ?? 0);

  const workforceSummary = deepFreeze({
    workforceState,
    employeesWorkingCount: employees.filter((e) => e?.status === "Working" || e?.status === "Needs Review").length,
    employeesNeedingReviewCount: employees.filter((e) => (e?.currentWorkload?.waitingOnYouCount ?? 0) > 0).length,
    employeesOfflineCount: employees.filter((e) => e?.status === "Offline").length,
    todayTasksCompletedCount: completedToday,
    hoursSavedToday,
    estimatedReviewTimeMinutes: 0,
  });

  const activities = companyRuntime.getActivities?.() ?? [];
  const latestActivityISO = computeLatestActivityISO(activities);
  const sortedActivities = sortActivitiesDesc(activities);
  const recentActivities = sortedActivities.slice(0, 5).map((a) => ({
    timestampISO: a.timestampISO,
    text: `${a.employee} ${a.action} ${a.object}`,
    category: a.action,
  }));

  const activitySummary = deepFreeze({
    totalActivities: sortedActivities.length,
    latestActivityISO: latestActivityISO ?? "",
    recentActivities,
  });

  const connectedSystems = companyRuntime.getConnectedSystems?.() ?? [];
  const disconnectedSystems = disconnectedSystemsFromConnectedSystems(connectedSystems);

  const knowledgeRepo = companyRuntime.getKnowledgeRepository?.() ?? { items: [] };
  const knowledgeActiveCount = listActiveKnowledgeCount(knowledgeRepo);

  const knowledgeFailures = knowledgeFailuresFromActivities(activities);

  const { failed: failedCommunications, pendingApproval: pendingApprovalCommunications } = communicationsToCompute(companyRuntime);

  const businessCapabilityEngineInstance =
    businessCapabilityEngine ?? new BusinessCapabilityEngine();
  const capabilityEval = businessCapabilityEngineInstance.evaluate({
    companyRuntime,
    onboardingRuntime: undefined,
    nowISO: clockISO,
  });

  const blockedCapabilities = Array.isArray(capabilityEval?.blockedCapabilities) ? capabilityEval.blockedCapabilities : [];

  const blockedWorkCount = 0; // deterministic placeholder: Sprint 4 uses explicit work states later.
  const urgentWorkQueueItems = (() => {
    const queue = companyRuntime.getWorkQueue?.() ?? [];
    const list = Array.isArray(queue) ? queue : [];
    return list.filter((i) => i?.status === "Needs Review" && String(i?.priority ?? "") === "High").length;
  })();

  const prioritySignals = [];

  if (pendingReviews > 0) {
    prioritySignals.push({
      id: "priority_review_work_queue",
      label: "Approval work is waiting",
      priority: "HIGH",
      type: "GOVERNANCE",
      target: "work_queue",
      count: pendingReviews,
    });
  }

  if (blockedWorkCount > 0) {
    prioritySignals.push({
      id: "priority_blocked_work",
      label: "Blocked work needs unblocking",
      priority: "HIGH",
      type: "OPERATIONS",
      target: "work_queue",
      count: blockedWorkCount,
    });
  }

  if (failedCommunications > 0) {
    prioritySignals.push({
      id: "priority_failed_communications",
      label: "Failed communications require attention",
      priority: "HIGH",
      type: "COMMUNICATIONS",
      target: "communications",
      count: failedCommunications,
    });
  }

  if (disconnectedSystems.length > 0) {
    prioritySignals.push({
      id: "priority_disconnected_systems",
      label: "Disconnected systems need reconnection",
      priority: "MEDIUM",
      type: "INTEGRATIONS",
      target: "connected_systems",
      count: disconnectedSystems.length,
    });
  }

  const knowledgeIssues = knowledgeActiveCount === 0;
  if (knowledgeIssues) {
    prioritySignals.push({
      id: "priority_knowledge_issues",
      label: "Knowledge is empty or archived",
      priority: "MEDIUM",
      type: "KNOWLEDGE",
      target: "knowledge_repository",
      count: knowledgeActiveCount,
    });
  }

  const capabilityGaps = blockedCapabilities.length > 0 || capabilityEval?.overallReadiness !== "READY";
  if (capabilityGaps) {
    prioritySignals.push({
      id: "priority_capability_readiness_gaps",
      label: "Capability readiness gaps exist",
      priority: "MEDIUM",
      type: "READINESS",
      target: "capabilities",
      count: blockedCapabilities.length,
    });
  }

  if (urgentWorkQueueItems > 0) {
    prioritySignals.push({
      id: "priority_urgent_work_queue_items",
      label: "High-intent queue items await review",
      priority: "MEDIUM",
      type: "GOVERNANCE",
      target: "work_queue",
      count: urgentWorkQueueItems,
    });
  }

  prioritySignals.sort((a, b) => priorityOrderingIndexForId(a.id) - priorityOrderingIndexForId(b.id));

  const actionList = [];
  const actionById = new Map();

  const addAction = (action) => {
    actionById.set(action.id, action);
    return action;
  };

  // Review work queue action.
  if (pendingReviews > 0) {
    addAction(
      createCompanyBriefAction({
        id: "action_review_work_queue",
        label: "Review Work Queue",
        type: "GOVERNANCE",
        target: "work_queue",
        priority: "HIGH",
        metadata: deepFreeze({ pendingReviews }),
      }),
    );
  }

  // Communication approval action.
  if (pendingApprovalCommunications > 0) {
    addAction(
      createCompanyBriefAction({
        id: "action_approve_communications",
        label: "Approve Communications",
        type: "GOVERNANCE",
        target: "communications",
        priority: "HIGH",
        metadata: deepFreeze({ pendingApprovalCommunications }),
      }),
    );
  }

  // Reconnect disconnected systems actions.
  for (const s of disconnectedSystems) {
    const provider = String(s.provider ?? "");
    const category = String(s.category ?? "");
    const sysType = provider === "email" ? "email" : provider === "crm" ? "crm" : provider || category || "system";
    const actionId = `action_reconnect_${stableIdPart(sysType)}`;
    const label =
      sysType === "email"
        ? "Reconnect Email"
        : sysType === "crm"
          ? "Reconnect CRM"
          : `Reconnect ${sysType}`;

    if (!actionById.has(actionId)) {
      addAction(
        createCompanyBriefAction({
          id: actionId,
          label,
          type: "INTEGRATIONS",
          target: `connected_system:${stableIdPart(s.id)}`,
          priority: "MEDIUM",
          metadata: deepFreeze({ systemId: s.id, status: s.status, health: s.health }),
        }),
      );
    }
  }

  // Knowledge upload/review action(s).
  const hasKnowledgeFailures = knowledgeFailures.count > 0 || knowledgeActiveCount === 0;
  if (hasKnowledgeFailures) {
    addAction(
      createCompanyBriefAction({
        id: "action_upload_knowledge",
        label: "Upload Knowledge",
        type: "KNOWLEDGE",
        target: "knowledge_repository",
        priority: "MEDIUM",
        metadata: deepFreeze({ knowledgeActiveCount, knowledgeFailures }),
      }),
    );
  }

  // Always provide a workforce view action.
  addAction(
    createCompanyBriefAction({
      id: "action_view_digital_workforce",
      label: "View Digital Workforce",
      type: "NAVIGATION",
      target: "digital_workforce",
      priority: "LOW",
      metadata: deepFreeze({ workforceState }),
    }),
  );

  actionList.push(...actionById.values());

  actionList.sort((a, b) => {
    const pr = (p) => (p === "HIGH" ? 0 : p === "MEDIUM" ? 1 : 2);
    return pr(a.priority) - pr(b.priority) || a.id.localeCompare(b.id);
  });

  const recommendedActions = deepFreeze(actionList);

  const decisionsWaiting = [];
  if (pendingReviews > 0) {
    decisionsWaiting.push(
      deepFreeze({
        id: "decision_review_work_queue",
        label: "Decide how to handle queued buyer response drafts",
        target: "work_queue",
        priority: "HIGH",
        metadata: deepFreeze({ pendingReviews }),
      }),
    );
  }
  if (pendingApprovalCommunications > 0) {
    decisionsWaiting.push(
      deepFreeze({
        id: "decision_approve_communications",
        label: "Approve pending outbound buyer communications",
        target: "communications",
        priority: "HIGH",
        metadata: deepFreeze({ pendingApprovalCommunications }),
      }),
    );
  }

  const risks = [];
  const opportunities = [];

  if (failedCommunications > 0) {
    risks.push(
      buildRisk({
        id: "risk_communication_failures",
        label: "Communication failures",
        status: "ACTIVE",
        priority: "HIGH",
        summary: `${failedCommunications} communications failed.`,
        metadata: deepFreeze({ failedCommunications }),
      }),
    );
  }

  if (disconnectedSystems.length > 0) {
    risks.push(
      buildRisk({
        id: "risk_disconnected_systems",
        label: "Disconnected systems",
        status: "ACTIVE",
        priority: "MEDIUM",
        summary: `${disconnectedSystems.length} connected system(s) are not ready.`,
        metadata: deepFreeze({ disconnectedSystemIds: disconnectedSystems.map((x) => x.id) }),
      }),
    );
  }

  if (knowledgeFailures.count > 0) {
    risks.push(
      buildRisk({
        id: "risk_knowledge_publish_ingestion_failures",
        label: "Knowledge publish/ingestion failures",
        status: "ACTIVE",
        priority: "MEDIUM",
        summary: `${knowledgeFailures.count} knowledge failure event(s) detected.`,
        metadata: deepFreeze(knowledgeFailures),
      }),
    );
  }

  if (pendingReviews > 0) {
    risks.push(
      buildRisk({
        id: "risk_approval_backlog",
        label: "Approval backlog",
        status: "ACTIVE",
        priority: "HIGH",
        summary: `${pendingReviews} item(s) require governance review.`,
        metadata: deepFreeze({ pendingReviews }),
      }),
    );
  }

  if (capabilityGaps && blockedCapabilities.length > 0) {
    risks.push(
      buildRisk({
        id: "risk_blocked_capabilities",
        label: "Blocked capabilities",
        status: "ACTIVE",
        priority: "MEDIUM",
        summary: `Capability readiness is not complete (${blockedCapabilities.length} blocked).`,
        metadata: deepFreeze({ blockedCapabilities: blockedCapabilities.map((c) => c?.id ?? c) }),
      }),
    );
  }

  if (knowledgeActiveCount === 0) {
    risks.push(
      buildRisk({
        id: "risk_empty_knowledge",
        label: "Empty knowledge",
        status: "ACTIVE",
        priority: "MEDIUM",
        summary: "No active knowledge is available.",
        metadata: deepFreeze({ knowledgeActiveCount }),
      }),
    );
  }

  const businessProfile = companyRuntime.getBusinessProfile?.() ?? {};
  const completionStatus = businessProfile?.metadata?.completionStatus ?? "";
  if (completionStatus && completionStatus !== "COMPLETE") {
    risks.push(
      buildRisk({
        id: "risk_missing_profile_business_setup",
        label: "Missing business setup",
        status: "ACTIVE",
        priority: "MEDIUM",
        summary: `Business setup completion status=${completionStatus}.`,
        metadata: deepFreeze({ completionStatus }),
      }),
    );
  }

  // Opportunities
  if (knowledgeActiveCount > 0 && connectedSystems?.length) {
    // Opportunity: publish more knowledge if active items are fewer than categories.
    const knowledgeSystems = disconnectedSystemsFromConnectedSystems(connectedSystems).filter((s) => s?.id === "cs_knowledge_os" ? true : true);
    void knowledgeSystems;
  }
  // Publish more knowledge based on Knowledge OS metadata (publishedCount/categoriesCount).
  const knowledgeOs = Array.isArray(connectedSystems)
    ? connectedSystems.find((s) => String(s?.id ?? "") === "cs_knowledge_os")
    : null;
  const publishedCount = Number(knowledgeOs?.metadata?.publishedCount ?? 0);
  const categoriesCount = Number(knowledgeOs?.metadata?.categoriesCount ?? 0);
  if (categoriesCount > 0 && publishedCount < categoriesCount) {
    opportunities.push(
      buildOpportunity({
        id: "opp_publish_more_knowledge",
        label: "Publish more knowledge",
        status: "OPEN",
        priority: "MEDIUM",
        summary: `Published knowledge=${publishedCount} < knowledge categories=${categoriesCount}.`,
        metadata: deepFreeze({ publishedCount, categoriesCount }),
      }),
    );
  }

  if (disconnectedSystems.length > 0) {
    opportunities.push(
      buildOpportunity({
        id: "opp_connect_missing_systems",
        label: "Connect missing systems",
        status: "OPEN",
        priority: "MEDIUM",
        summary: "Reconnect disconnected integrations to restore automation.",
        metadata: deepFreeze({
          disconnectedSystemIds: disconnectedSystems.map((x) => x.id),
        }),
      }),
    );
  }

  // Hire recommended employees if recommended roles are not present among employees.
  const recommendedEmployees = businessProfile?.metadata?.derived?.recommendations?.recommendedDigitalEmployees ?? [];
  const rolesPresent = new Set(employees.map((e) => String(e?.employeeName ?? e?.name ?? e?.role ?? "")));
  const missingRecommendedEmployees = Array.isArray(recommendedEmployees)
    ? recommendedEmployees.filter((r) => r && !rolesPresent.has(String(r)))
    : [];
  if (missingRecommendedEmployees.length > 0) {
    opportunities.push(
      buildOpportunity({
        id: "opp_hire_recommended_employees",
        label: "Hire recommended employees",
        status: "OPEN",
        priority: "LOW",
        summary: `${missingRecommendedEmployees.length} recommended employee role(s) are not present.`,
        metadata: deepFreeze({ missingRecommendedEmployees }),
      }),
    );
  }

  if (completionStatus && completionStatus !== "COMPLETE") {
    opportunities.push(
      buildOpportunity({
        id: "opp_complete_onboarding",
        label: "Complete onboarding",
        status: "OPEN",
        priority: "MEDIUM",
        summary: `Business setup is not complete (${completionStatus}).`,
        metadata: deepFreeze({ completionStatus }),
      }),
    );
  }

  const communicationSetup = companyRuntime.getCommunicationSetup?.() ?? {};
  const readiness = communicationSetup?.readiness ?? {};
  const readinessOk =
    Boolean(readiness.emailReady) &&
    Boolean(readiness.smsReady) &&
    Boolean(readiness.brandReady) &&
    Boolean(readiness.quietHoursReady) &&
    Boolean(readiness.approvalPolicyReady);
  if (!readinessOk) {
    opportunities.push(
      buildOpportunity({
        id: "opp_improve_communication_readiness",
        label: "Improve communication readiness",
        status: "OPEN",
        priority: "MEDIUM",
        summary: "Communication setup readiness is not complete.",
        metadata: deepFreeze(readiness),
      }),
    );
  }

  if (pendingReviews > 0) {
    opportunities.push(
      buildOpportunity({
        id: "opp_review_automation_opportunities",
        label: "Review automation opportunities",
        status: "OPEN",
        priority: "LOW",
        summary: "You have queue items that may benefit from automation.",
        metadata: deepFreeze({ pendingReviews }),
      }),
    );
  }

  // Build section items/actions mapping.
  const prioritiesForSections = prioritySignals.map((p) => deepFreeze({ ...p }));
  const decisionsWaitingItems = decisionsWaiting.map((d) => deepFreeze(d));
  const risksItems = risks.map((r) => deepFreeze(r));
  const oppItems = opportunities.map((o) => deepFreeze(o));

  const companyPulseSection = createCompanyBriefSection({
    id: SECTION_IDS.COMPANY_PULSE,
    title: "Company Pulse",
    subtitle: "What the business needs to know immediately",
    status: overallStatusForBrief({ pendingReviews, disconnectedSystems, failedCommunications, knowledgeActiveCount }),
    priority: pendingReviews > 0 ? "HIGH" : "MEDIUM",
    summary: "Executive snapshot of current operational readiness.",
    items: deepFreeze({
      workforceSummary,
      activitySummary: { totalActivities: activitySummary.totalActivities },
      disconnectedSystemsCount: disconnectedSystems.length,
      pendingReviews,
      knowledgeActiveCount,
    }),
    actions: deepFreeze([]),
    metadata: deepFreeze({
      version: COMPANY_BRIEF_VERSION,
    }),
  });

  const todayPrioritiesSection = createCompanyBriefSection({
    id: SECTION_IDS.PRIORITIES,
    title: "Today's Priorities",
    subtitle: "The order of what to do next",
    status: "READY",
    priority: "HIGH",
    summary: "Priorities are ranked by urgency and governance impact.",
    items: prioritiesForSections,
    actions: recommendedActions.filter((a) => a.priority === "HIGH" || a.type === "INTEGRATIONS"),
    metadata: deepFreeze({ count: prioritiesForSections.length }),
  });

  const decisionsWaitingSection = createCompanyBriefSection({
    id: SECTION_IDS.DECISIONS_WAITING,
    title: "Decisions Waiting",
    subtitle: "Governance decisions that require human confirmation",
    status: pendingReviews > 0 || pendingApprovalCommunications > 0 ? "READY" : "EMPTY",
    priority: "HIGH",
    summary: "Items waiting for approval or review.",
    items: decisionsWaitingItems,
    actions: recommendedActions.filter((a) => a.target === "work_queue" || a.target === "communications"),
    metadata: deepFreeze({ decisionsWaitingCount: decisionsWaitingItems.length }),
  });

  const digitalWorkforceSection = createCompanyBriefSection({
    id: SECTION_IDS.DIGITAL_WORKFORCE,
    title: "Digital Workforce",
    subtitle: "Where workforce capacity stands right now",
    status: "READY",
    priority: "MEDIUM",
    summary: "Operational workforce snapshot.",
    items: deepFreeze({
      workforceSummary,
      topEmployee: workforceTopEmployee(employees),
    }),
    actions: recommendedActions.filter((a) => a.target === "digital_workforce"),
    metadata: deepFreeze({ workforceState }),
  });

  const recentActivitySection = createCompanyBriefSection({
    id: SECTION_IDS.RECENT_ACTIVITY,
    title: "Recent Activity",
    subtitle: "Deterministic audit-like activity feed",
    status: "READY",
    priority: "LOW",
    summary: `Latest activity across runtime events (${activitySummary.totalActivities} total).`,
    items: deepFreeze(recentActivities.map((a) => ({ ...a }))),
    actions: deepFreeze([]),
    metadata: deepFreeze({ latestActivityISO: activitySummary.latestActivityISO }),
  });

  const risksSection = createCompanyBriefSection({
    id: SECTION_IDS.RISKS,
    title: "Risks",
    subtitle: "What could go wrong if nothing changes",
    status: risks.length ? "READY" : "EMPTY",
    priority: "HIGH",
    summary: "Detected deterministic risks based on current runtime state.",
    items: risksItems,
    actions: recommendedActions.filter((a) => a.type === "INTEGRATIONS"),
    metadata: deepFreeze({ riskCount: risksItems.length }),
  });

  const oppSection = createCompanyBriefSection({
    id: SECTION_IDS.OPPORTUNITIES,
    title: "Opportunities",
    subtitle: "What you can improve next",
    status: opportunities.length ? "READY" : "EMPTY",
    priority: "MEDIUM",
    summary: "Detected deterministic opportunities from runtime signals.",
    items: oppItems,
    actions: recommendedActions.filter((a) => a.type === "KNOWLEDGE" || a.type === "INTEGRATIONS"),
    metadata: deepFreeze({ opportunityCount: oppItems.length }),
  });

  const recommendationsSection = createCompanyBriefSection({
    id: SECTION_IDS.RECOMMENDATIONS,
    title: "Recommendations",
    subtitle: "Actionable next steps for the business owner",
    status: "READY",
    priority: "HIGH",
    summary: "Actions required to maintain governance and operational continuity.",
    items: deepFreeze([]),
    actions: recommendedActions,
    metadata: deepFreeze({ actionCount: recommendedActions.length }),
  });

  const sections = deepFreeze([
    companyPulseSection,
    todayPrioritiesSection,
    decisionsWaitingSection,
    digitalWorkforceSection,
    recentActivitySection,
    risksSection,
    oppSection,
    recommendationsSection,
  ]);

  // Executable: create executive summary string deterministically.
  const summary = deterministicExecutiveSummary({
    pendingReviews,
    disconnectedSystemsCount: disconnectedSystems.length,
    failedCommunicationsCount: failedCommunications,
    knowledgeActiveCount,
  });

  const overallStatus = overallStatusForBrief({
    pendingReviews,
    disconnectedSystems,
    failedCommunications,
    knowledgeActiveCount,
  });

  const brief = createCompanyBrief({
    briefId,
    companyId,
    generatedAt: clockISO,
    greeting,
    summary,
    overallStatus,
    sections,
    priorities: prioritiesForSections,
    decisionsWaiting,
    risks,
    opportunities,
    workforceSummary,
    activitySummary,
    recommendedActions,
    metadata: deepFreeze({
      generatedBy: "CompanyBriefEngine",
      runtime: "CompanyWorkspaceRuntime",
      capabilityEngineOverallReadiness: capabilityEval?.overallReadiness ?? "UNKNOWN",
    }),
  });

  validateCompanyBrief(brief);
  return brief;
}

function workforceTopEmployee(employees) {
  const list = Array.isArray(employees) ? employees : [];
  if (!list.length) return null;
  let best = list[0];
  for (const e of list) {
    const waiting = e?.currentWorkload?.waitingOnYouCount ?? 0;
    const bestWaiting = best?.currentWorkload?.waitingOnYouCount ?? 0;
    if (waiting > bestWaiting) best = e;
  }
  return deepFreeze({
    employeeId: best?.employeeId ?? "",
    name: best?.employeeName ?? best?.name ?? "",
    role: best?.role ?? "",
    status: best?.status ?? "",
  });
}

function deterministicExecutiveSummary({ pendingReviews, disconnectedSystemsCount, failedCommunicationsCount, knowledgeActiveCount }) {
  const parts = [];

  if (pendingReviews === 1) parts.push("1 item needs review");
  else parts.push(`${pendingReviews} items need review`);

  if (failedCommunicationsCount > 0) parts.push(`${failedCommunicationsCount} communications failed`);
  else parts.push("Communications are healthy");

  if (knowledgeActiveCount > 0) parts.push("Knowledge is ready");
  else parts.push("Knowledge is empty");

  if (disconnectedSystemsCount > 0) parts.push(`${disconnectedSystemsCount} connected system(s) need attention`);
  else parts.push("All connected systems are ready");

  // Keep concise, deterministic: join with periods.
  return parts.join(".") + ".";
}

function overallStatusForBrief({ pendingReviews, disconnectedSystems, failedCommunications, knowledgeActiveCount }) {
  const disconnectedCount = Array.isArray(disconnectedSystems) ? disconnectedSystems.length : 0;
  const failedCount = Number(failedCommunications ?? 0);
  const highRisk =
    pendingReviews > 0 ||
    failedCount > 0 ||
    disconnectedCount > 0 ||
    knowledgeActiveCount === 0;
  return highRisk ? "NEEDS_ATTENTION" : "HEALTHY";
}

