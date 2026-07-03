import { CompanyWorkspaceRuntime } from "../../../backend/core/company/CompanyWorkspaceRuntime.js";
import { WorkspaceGenerator } from "../../../backend/core/workspace/WorkspaceGenerator.js";
import { WorkspaceViewAdapter } from "../../../backend/core/workspace/views/WorkspaceViewAdapter.js";
import { COMPANY_EVENT_TYPES } from "../../../backend/core/company/events/CompanyEventTypes.js";
import { createCompanyEvent } from "../../../backend/core/company/events/CompanyEvent.js";
import { MockWorkspaceApi } from "./MockWorkspaceApi";

import { CompanyBriefEngine } from "../../../backend/core/business-intelligence/company-brief/CompanyBriefEngine.js";
import { CompanyHealthEngine } from "../../../backend/core/business-intelligence/company-health/CompanyHealthEngine.js";
import { CompanyInsightEngine } from "../../../backend/core/business-intelligence/insights/CompanyInsightEngine.js";
import { CompanyOpportunityEngine } from "../../../backend/core/business-intelligence/opportunities/CompanyOpportunityEngine.js";
import { CompanyRecommendationEngine } from "../../../backend/core/business-intelligence/recommendations/CompanyRecommendationEngine.js";
import { MissionControlGenerator } from "../../../backend/core/mission-control/MissionControlGenerator.js";
import { MissionControlViewAdapter } from "../../../backend/core/mission-control/views/MissionControlViewAdapter.js";

import { TeamRuntime } from "../../../backend/core/team/TeamRuntime.js";
import { TeamViewAdapter } from "../../../backend/core/team/views/TeamViewAdapter.js";

import { RequestRuntime } from "../../../backend/core/request/RequestRuntime.js";
import { RequestViewAdapter } from "../../../backend/core/request/views/RequestViewAdapter.js";
import { REQUEST_EVENT_TYPES } from "../../../backend/core/request/RequestEventTypes.js";

import { WorkRuntime } from "../../../backend/core/work/WorkRuntime.js";
import { WorkViewAdapter } from "../../../backend/core/work/views/WorkViewAdapter.js";

import { CapabilityRuntime } from "../../../backend/core/capabilities/runtime/CapabilityRuntime.js";
import { CapabilityIntelligenceEngine } from "../../../backend/core/capabilities/intelligence/CapabilityIntelligenceEngine.js";
import { CapabilityViewAdapter } from "../../../backend/core/capabilities/views/CapabilityViewAdapter.js";

import { CommunicationRuntime } from "../../../backend/core/communications/CommunicationRuntime.js";
import { COMMUNICATION_EVENT_TYPES } from "../../../backend/core/communications/CommunicationEventTypes.js";
import {
  buildCommunicationThreadForSeed,
  buildCommunicationMessageForSeed,
} from "../../../backend/core/communications/CommunicationBuilder.js";
import { CommunicationViewAdapter } from "../../../backend/core/communications/views/CommunicationViewAdapter.js";

import { AnalyticsRuntime } from "../../../backend/core/analytics/AnalyticsRuntime.js";
import { buildAnalyticsDataPointForSeed, buildAnalyticsMetricForSeed } from "../../../backend/core/analytics/AnalyticsBuilder.js";
import { computeAnalyticsDerivedMetrics } from "../../../backend/core/analytics/AnalyticsMetrics.js";
import { AnalyticsIntelligenceEngine } from "../../../backend/core/analytics/intelligence/AnalyticsIntelligenceEngine.js";
import { AnalyticsViewAdapter } from "../../../backend/core/analytics/views/AnalyticsViewAdapter.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

function makeCapabilitiesReady(overrides: Record<string, any> = {}) {
  const base = [
    { id: "company_identity", status: "READY" },
    { id: "business_profile", status: "READY" },
    { id: "brand", status: "READY" },
    { id: "integrations", status: "READY" },
    { id: "knowledge", status: "READY" },
    { id: "communications", status: "READY" },
    { id: "digital_workforce", status: "READY" },
    { id: "workspace", status: "READY" },
    { id: "analytics", status: "READY" },
  ];

  const map = new Map(base.map((c) => [c.id, { ...c }]));
  for (const [k, v] of Object.entries(overrides)) {
    if (!map.has(k)) map.set(k, { id: k, status: v });
    else (map.get(k) as any).status = v;
  }

  return {
    overallReadiness: "READY",
    capabilities: [...map.values()],
  };
}

export class WorkspaceService {
  private runtime: CompanyWorkspaceRuntime;
  private adapter: WorkspaceViewAdapter;
  private api: MockWorkspaceApi;
  private businessCapabilities = makeCapabilitiesReady();
  private generator = new WorkspaceGenerator({ nowISO: NOW_ISO });
  private teamRuntime: TeamRuntime;
  private requestRuntime: RequestRuntime;
  private workRuntime: WorkRuntime;

  constructor() {
    this.runtime = new CompanyWorkspaceRuntime();
    this.teamRuntime = new TeamRuntime();
    this.requestRuntime = new RequestRuntime({ nowISO: NOW_ISO });
    this.workRuntime = new WorkRuntime({ nowISO: NOW_ISO });

    // Seed a stable “after demo intake” inquiry event so the queue/dashboard
    // have deterministic runtime-derived content.
    const demoEvent = createCompanyEvent({
      id: "evt_demo_website_inquiry_received_1",
      timestampISO: "2026-07-01T19:19:55.460Z",
      type: COMPANY_EVENT_TYPES.WEBSITE_INQUIRY_RECEIVED,
      source: "frontend-mock-workspace-seed",
      payload: {
        buyer: {
          buyerId: "buyer_web_rachael_nguyen",
          name: "Rachael Nguyen",
          email: "rachael.nguyen@example.com",
          phone: "(555) 019-2219",
        },
        propertyId: "prop_68_mystic",
        message:
          "Hi! I'm interested in the property and would like to discuss next steps today. Can you share a good walkthrough window?",
        submittedAtISO: "2026-07-01T19:19:55.460Z",
        priority: "High",
        employeeName: "Property Interest Coordinator",
        queueVisible: true,
        draftResponseReady: true,
        responseTimeMinutes: 32,
        inquiryId: "inq_demo_rachael_nguyen",
        status: "Needs Review",
      },
    });
    this.runtime.applyEvent(demoEvent);

    // Seed deterministic RequestRuntime entries so the first UI experience has content.
    // This sprint remains rendering-only (no qualification, conversion, or work creation).
    this.requestRuntime.applyEvent({
      id: "evt_req_seed_incoming_1",
      timestampISO: NOW_ISO,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "frontend-mock-workspace-seed",
      payload: {
        request: {
          id: "req_seed_1",
          title: "Website inquiry",
          description: "Incoming request from website intake.",
          requestType: "inquiry",
          status: "received",
          priority: "high",
          channel: "website",
          source: "demo-seed",
          requester: "prospective-client",
          dueAt: "2026-06-20T00:00:00.000Z",
          assignedWorkId: null,
          assignedTeamMemberId: null,
          qualificationStatus: null,
          attachments: [],
          metadata: {},
        },
      },
    });

    this.requestRuntime.applyEvent({
      id: "evt_req_seed_incoming_2",
      timestampISO: NOW_ISO,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "frontend-mock-workspace-seed",
      payload: {
        request: {
          id: "req_seed_2",
          title: "Phone inquiry",
          description: "Incoming request from phone intake.",
          requestType: "inquiry",
          status: "received",
          priority: "medium",
          channel: "phone",
          source: "demo-seed",
          requester: "prospective-client",
          dueAt: null,
          assignedWorkId: null,
          assignedTeamMemberId: null,
          qualificationStatus: null,
          attachments: [],
          metadata: {},
        },
      },
    });

    this.requestRuntime.applyEvent({
      id: "evt_req_seed_incoming_2_qualified",
      timestampISO: NOW_ISO,
      type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
      source: "frontend-mock-workspace-seed",
      payload: {
        requestId: "req_seed_2",
        qualificationStatus: "triaged",
      },
    });

    this.adapter = new WorkspaceViewAdapter({ runtime: this.runtime });
    // Review-work actions still live in the mock API (communication engine + coordinator).
    this.api = new MockWorkspaceApi({ runtime: this.runtime });
  }

  private getWorkspaceConfig() {
    return this.generator.generate({
      runtime: this.runtime,
      businessProfile: this.runtime.getBusinessProfile(),
      companyProfile: this.runtime.getCompanyProfile(),
      businessCapabilities: this.businessCapabilities,
      nowISO: NOW_ISO,
    });
  }

  loadDashboard() {
    const workspaceConfig = this.getWorkspaceConfig();
    return this.adapter.getDashboardView(workspaceConfig);
  }

  loadDigitalWorkforce() {
    const workspaceConfig = this.getWorkspaceConfig();
    return this.adapter.getDigitalWorkforceView(workspaceConfig);
  }

  loadWorkQueue() {
    const workspaceConfig = this.getWorkspaceConfig();
    return this.adapter.getWorkQueueView(workspaceConfig);
  }

  loadWorkspaceViewModel() {
    const workspaceConfig = this.getWorkspaceConfig();
    // Full workspace shell snapshot for application-level rendering.
    return this.adapter.translate(workspaceConfig);
  }

  loadMissionControlViewModel() {
    // Mission Control is derived from canonical intelligence objects (deterministic).
    const brief = new CompanyBriefEngine({ nowISO: NOW_ISO }).generate({ companyRuntime: this.runtime });
    const health = new CompanyHealthEngine({ nowISO: NOW_ISO }).generate({ companyRuntime: this.runtime, companyBrief: brief });
    const insights = new CompanyInsightEngine({ nowISO: NOW_ISO }).generate({
      previousCompanyHealth: health,
      currentCompanyHealth: health,
    });
    const opportunities = new CompanyOpportunityEngine({ nowISO: NOW_ISO }).generate({
      companyRuntime: this.runtime,
      companyBrief: brief,
      companyHealth: health,
      companyInsights: insights,
    });
    const recommendations = new CompanyRecommendationEngine({ nowISO: NOW_ISO }).generate({
      companyBrief: brief,
      companyHealth: health,
      companyInsights: insights,
      companyOpportunities: opportunities,
    });

    const missionControl = new MissionControlGenerator({ nowISO: NOW_ISO }).generate({
      companyBrief: brief,
      companyHealth: health,
      companyInsights: insights,
      companyOpportunities: opportunities,
      companyRecommendations: recommendations,
    });

    return new MissionControlViewAdapter().translate(missionControl);
  }

  loadTeamViewModel() {
    const brief = new CompanyBriefEngine({ nowISO: NOW_ISO }).generate({ companyRuntime: this.runtime });
    const adapter = new TeamViewAdapter({ nowISO: NOW_ISO });
    // Read-only translation: do not mutate runtime.
    return adapter.translate({
      teamRuntime: this.teamRuntime,
      companyRuntime: this.runtime,
      companyBrief: brief,
    });
  }

  loadWorkViewModel() {
    const adapter = new WorkViewAdapter({ nowISO: NOW_ISO });
    // Read-only translation: do not mutate runtimes.
    return adapter.translate({
      workRuntime: this.workRuntime,
      teamRuntime: this.teamRuntime,
      companyRuntime: this.runtime,
    });
  }

  loadKnowledgeViewModel() {
    const workspaceConfig = this.getWorkspaceConfig();
    return this.adapter.getKnowledgeView(workspaceConfig);
  }

  loadRequestViewModel() {
    const adapter = new RequestViewAdapter({ nowISO: NOW_ISO });
    return adapter.translate({
      requestRuntime: this.requestRuntime,
      companyRuntime: this.runtime,
      teamRuntime: this.teamRuntime,
      workRuntime: this.workRuntime,
    });
  }

  loadCapabilityViewModel() {
    const capabilityRuntime = new CapabilityRuntime({ seed: null });

    const report = new CapabilityIntelligenceEngine({ nowISO: NOW_ISO }).generate({
      capabilityRuntime,
      teamRuntime: this.teamRuntime,
      workRuntime: this.workRuntime,
      companyWorkspaceRuntime: this.runtime,
      companyId: String(this.runtime.getCompany?.()?.companyName ?? "company"),
      nowISO: NOW_ISO,
    } as any);

    const adapter = new CapabilityViewAdapter({ nowISO: NOW_ISO });
    return adapter.translate({
      capabilityRuntime,
      capabilityIntelligenceReport: report,
    });
  }

  loadCommunicationViewModel() {
    const communicationRuntime = new CommunicationRuntime({ nowISO: NOW_ISO });

    // Deterministic demo communications so the executive dashboard has stable content.
    const thread = buildCommunicationThreadForSeed({
      nowISO: NOW_ISO,
      overrides: {
        id: "ct_seed_1",
        subject: "Executive communications follow-up",
        channel: "internal",
        status: "draft",
        participants: [
          { id: "tm_ceo", type: "human" },
          { id: "p_external_1", type: "external_system" },
        ],
        messageIds: [],
        relatedObjects: [{ workItemId: "wi_seed_communication_1" }],
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        metadata: {},
      },
    });

    communicationRuntime.applyEvent({
      id: "evt_ct_seed_1_created",
      timestampISO: NOW_ISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
      source: "frontend-mock-workspace-seed",
      payload: { thread },
    });

    // Drafted queued message older than threshold -> queued attention.
    const draftedQueued = buildCommunicationMessageForSeed({
      nowISO: "2026-06-20T00:00:00.000Z",
      threadId: "ct_seed_1",
      overrides: {
        id: "cm_seed_queued_1",
        direction: "outbound",
        channel: "email",
        status: "draft",
        subject: "Queued exec update",
        body: "Draft body for queued exec update.",
        sender: { id: "tm_ceo", type: "human" },
        recipients: [{ id: "p_external_1", type: "external_system" }],
        relatedObjects: [{ workItemId: "wi_seed_communication_1" }],
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
      },
    });

    communicationRuntime.applyEvent({
      id: "evt_cm_seed_queued_1_drafted",
      timestampISO: NOW_ISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
      source: "frontend-mock-workspace-seed",
      payload: { message: draftedQueued },
    });

    communicationRuntime.applyEvent({
      id: "evt_cm_seed_queued_1_queued",
      timestampISO: NOW_ISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
      source: "frontend-mock-workspace-seed",
      payload: { messageId: "cm_seed_queued_1" },
    });

    // Failed message -> immediate attention.
    const draftedFailed = buildCommunicationMessageForSeed({
      nowISO: "2026-06-25T00:00:00.000Z",
      threadId: "ct_seed_1",
      overrides: {
        id: "cm_seed_failed_1",
        direction: "outbound",
        channel: "internal",
        status: "draft",
        subject: "Failed exec follow-up",
        body: "Body for a message that will fail.",
        sender: { id: "tm_ceo", type: "human" },
        recipients: [{ id: "p_external_1", type: "external_system" }],
        relatedObjects: [{ workItemId: "wi_seed_communication_1" }],
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
      },
    });

    communicationRuntime.applyEvent({
      id: "evt_cm_seed_failed_1_drafted",
      timestampISO: NOW_ISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
      source: "frontend-mock-workspace-seed",
      payload: { message: draftedFailed },
    });

    communicationRuntime.applyEvent({
      id: "evt_cm_seed_failed_1_failed",
      timestampISO: NOW_ISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_FAILED,
      source: "frontend-mock-workspace-seed",
      payload: { messageId: "cm_seed_failed_1" },
    });

    // Received inbound with missing sender/recipients.
    const draftedReceived = buildCommunicationMessageForSeed({
      nowISO: NOW_ISO,
      threadId: "ct_seed_1",
      overrides: {
        id: "cm_seed_received_1",
        direction: "inbound",
        channel: "chat",
        status: "draft",
        subject: "Inbound request requiring response",
        body: "Inbound body that needs response.",
        sender: null,
        recipients: [],
        relatedObjects: [{ workItemId: "wi_seed_communication_1" }],
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
      },
    });

    communicationRuntime.applyEvent({
      id: "evt_cm_seed_received_1_drafted",
      timestampISO: NOW_ISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
      source: "frontend-mock-workspace-seed",
      payload: { message: draftedReceived },
    });

    communicationRuntime.applyEvent({
      id: "evt_cm_seed_received_1_received",
      timestampISO: NOW_ISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_RECEIVED,
      source: "frontend-mock-workspace-seed",
      payload: { messageId: "cm_seed_received_1" },
    });

    const adapter = new CommunicationViewAdapter({ nowISO: NOW_ISO });
    return adapter.translate({
      communicationRuntime,
      workRuntime: this.workRuntime,
      teamRuntime: this.teamRuntime,
      companyWorkspaceRuntime: this.runtime,
    });
  }

  loadAnalyticsViewModel() {
    const companyId = String(this.runtime.getCompany?.()?.companyName ?? "company");

    const metrics = [
      buildAnalyticsMetricForSeed({ id: "request_received_count", category: "requests" }),
      buildAnalyticsMetricForSeed({ id: "request_qualified_count", category: "requests" }),
      buildAnalyticsMetricForSeed({ id: "request_converted_count", category: "requests" }),
      buildAnalyticsMetricForSeed({ id: "request_rejected_count", category: "requests" }),

      buildAnalyticsMetricForSeed({ id: "work_created_count", category: "work" }),
      buildAnalyticsMetricForSeed({ id: "work_assigned_count", category: "work" }),
      buildAnalyticsMetricForSeed({ id: "work_completed_count", category: "work" }),

      buildAnalyticsMetricForSeed({ id: "communication_sent_count", category: "communications" }),
      buildAnalyticsMetricForSeed({ id: "communication_failed_count", category: "communications" }),
      buildAnalyticsMetricForSeed({ id: "communication_received_count", category: "communications" }),

      buildAnalyticsMetricForSeed({ id: "team_member_created_count", category: "team" }),
      buildAnalyticsMetricForSeed({ id: "team_member_archived_count", category: "team" }),

      buildAnalyticsMetricForSeed({ id: "capability_registered_count", category: "capabilities" }),
      buildAnalyticsMetricForSeed({ id: "capability_archived_count", category: "capabilities" }),
    ];

    const dataPoints = [
      // Requests
      buildAnalyticsDataPointForSeed({
        id: "dp_req_received_1",
        metricId: "request_received_count",
        timestamp: NOW_ISO,
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_req_received_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
      buildAnalyticsDataPointForSeed({
        id: "dp_req_received_2",
        metricId: "request_received_count",
        timestamp: "2026-06-30T00:00:00.000Z",
        value: 2,
        dimensions: [],
        sourceEventId: "evt_seed_req_received_2",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
      buildAnalyticsDataPointForSeed({
        id: "dp_req_converted_1",
        metricId: "request_converted_count",
        timestamp: "2026-06-20T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_req_converted_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),

      // Work
      buildAnalyticsDataPointForSeed({
        id: "dp_work_created_1",
        metricId: "work_created_count",
        timestamp: "2026-06-20T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_work_created_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
      buildAnalyticsDataPointForSeed({
        id: "dp_work_created_2",
        metricId: "work_created_count",
        timestamp: NOW_ISO,
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_work_created_2",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
      buildAnalyticsDataPointForSeed({
        id: "dp_work_completed_1",
        metricId: "work_completed_count",
        timestamp: NOW_ISO,
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_work_completed_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),

      // Communications
      buildAnalyticsDataPointForSeed({
        id: "dp_comm_sent_1",
        metricId: "communication_sent_count",
        timestamp: "2026-06-05T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_comm_sent_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
      buildAnalyticsDataPointForSeed({
        id: "dp_comm_sent_2",
        metricId: "communication_sent_count",
        timestamp: "2026-06-25T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_comm_sent_2",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
      buildAnalyticsDataPointForSeed({
        id: "dp_comm_failed_1",
        metricId: "communication_failed_count",
        timestamp: "2026-06-15T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_comm_failed_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),

      // Team
      buildAnalyticsDataPointForSeed({
        id: "dp_team_created_1",
        metricId: "team_member_created_count",
        timestamp: "2026-06-01T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_team_created_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
      buildAnalyticsDataPointForSeed({
        id: "dp_team_created_2",
        metricId: "team_member_created_count",
        timestamp: "2026-06-20T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_team_created_2",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
      buildAnalyticsDataPointForSeed({
        id: "dp_team_archived_1",
        metricId: "team_member_archived_count",
        timestamp: "2026-06-15T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_team_archived_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),

      // Capabilities
      buildAnalyticsDataPointForSeed({
        id: "dp_cap_registered_1",
        metricId: "capability_registered_count",
        timestamp: "2026-06-10T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_cap_registered_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
      buildAnalyticsDataPointForSeed({
        id: "dp_cap_archived_1",
        metricId: "capability_archived_count",
        timestamp: "2026-06-25T00:00:00.000Z",
        value: 1,
        dimensions: [],
        sourceEventId: "evt_seed_cap_archived_1",
        sourceObject: {},
        metadata: {},
        metricDimensionsForValidation: [],
      }),
    ];

    const seed = () => {
      const derivedMetrics = computeAnalyticsDerivedMetrics({ metrics, dataPoints });
      return { metrics, dataPoints, derivedMetrics };
    };

    const analyticsRuntime = new AnalyticsRuntime({ seed, nowISO: NOW_ISO });

    const analyticsIntelligenceReport = new AnalyticsIntelligenceEngine({ nowISO: NOW_ISO }).generate({
      analyticsRuntime,
      companyId: companyId as any,
      nowISO: NOW_ISO,
    } as any);

    const adapter = new AnalyticsViewAdapter({ nowISO: NOW_ISO });
    return adapter.translate({
      analyticsRuntime,
      analyticsIntelligenceReport,
    });
  }

  loadReviewWork(workItemId: string) {
    return this.api.loadReviewWork(workItemId);
  }

  applyReviewDecision(workItemId: string, decision: "APPROVE" | "REJECT") {
    return this.api.applyReviewDecision(workItemId, decision);
  }

  sendReviewCommunication(workItemId: string) {
    return this.api.sendReviewCommunication(workItemId);
  }
}

