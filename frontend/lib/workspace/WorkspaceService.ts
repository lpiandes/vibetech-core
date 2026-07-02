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

import { WorkRuntime } from "../../../backend/core/work/WorkRuntime.js";
import { WorkViewAdapter } from "../../../backend/core/work/views/WorkViewAdapter.js";

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
  private workRuntime: WorkRuntime;

  constructor() {
    this.runtime = new CompanyWorkspaceRuntime();
    this.teamRuntime = new TeamRuntime();
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

