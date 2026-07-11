import { CompanyWorkspaceRuntime } from "../../../backend/core/company/CompanyWorkspaceRuntime.js";
import { WorkspaceGenerator } from "../../../backend/core/workspace/WorkspaceGenerator.js";
import { WorkspaceViewAdapter } from "../../../backend/core/workspace/views/WorkspaceViewAdapter.js";
import { COMPANY_EVENT_TYPES } from "../../../backend/core/company/events/CompanyEventTypes.js";
import { createCompanyEvent } from "../../../backend/core/company/events/CompanyEvent.js";
import { PropertyInterestCoordinator } from "../../../backend/core/employees/property-interest-coordinator/PropertyInterestCoordinator.js";
import { CommunicationEngine } from "../../../backend/core/communication/CommunicationEngine.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

/**
 * In-process delivery stub for MockWorkspaceApi.
 * Real Gmail delivery belongs in backend communications/integration providers
 * (googleapis), not in the frontend workspace adapter.
 */
class LocalWorkspaceEmailProvider {
  async send({ communication }: { communication?: { communicationId?: string } } = {}) {
    const id = String(communication?.communicationId ?? "unknown");
    return {
      providerMessageId: `local_${id}`,
      providerStatus: "sent",
      sentTimestampISO: new Date().toISOString(),
    };
  }
}

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

function parseSubjectAndBody(draftContent: string) {
  const lines = String(draftContent ?? "").split(/\r?\n/);
  const idx = lines.findIndex((l) => /^Subject:/i.test(l));

  if (idx >= 0) {
    const subject = lines[idx].replace(/^Subject:/i, "").trim() || "Buyer response";
    const bodyLines = lines.slice(idx + 1);
    while (bodyLines.length && bodyLines[0].trim().length === 0) bodyLines.shift();
    return { subject, body: bodyLines.join("\n") };
  }

  return { subject: "Buyer response", body: String(draftContent ?? "") };
}

export class MockWorkspaceApi {
  private runtime: CompanyWorkspaceRuntime;
  private adapter: WorkspaceViewAdapter;
  private generator: WorkspaceGenerator;
  private businessCapabilities = makeCapabilitiesReady();

  constructor({
    runtime,
    seedDemoInquiryEvent = true,
  }: {
    runtime?: CompanyWorkspaceRuntime;
    seedDemoInquiryEvent?: boolean;
  } = {}) {
    this.runtime = runtime ?? new CompanyWorkspaceRuntime();
    this.generator = new WorkspaceGenerator({ nowISO: NOW_ISO });
    this.adapter = new WorkspaceViewAdapter({ runtime: this.runtime });

    if (seedDemoInquiryEvent) {
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
    }
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

  private getRuntime() {
    return this.runtime;
  }

  async loadReviewWork(workItemId: string) {
    const runtime = this.getRuntime();
    const companyData = runtime.getCompanyData();
    const inquiry = companyData.inquiries.find(
      (i: any) => i.inquiryId === workItemId,
    );
    if (!inquiry) {
      throw new Error(`MockWorkspaceApi.loadReviewWork: inquiry not found: ${workItemId}`);
    }

    const buyer = companyData.buyers.find(
      (b: any) => b.buyerId === inquiry.buyerId,
    );
    if (!buyer) {
      throw new Error(`MockWorkspaceApi.loadReviewWork: buyer not found: ${inquiry.buyerId}`);
    }

    const property = companyData.properties.find(
      (p: any) => p.propertyId === inquiry.propertyId,
    );
    if (!property) {
      throw new Error(
        `MockWorkspaceApi.loadReviewWork: property not found: ${inquiry.propertyId}`,
      );
    }

    const knowledge = runtime.getKnowledge?.() ?? {};
    const responsePolicy = knowledge?.responsePreferences?.[0] ?? "";

    const coordinator = new PropertyInterestCoordinator();
    const { reviewWork } = await coordinator.run({
      inquiry: {
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
        message: inquiry.message,
        priority: inquiry.priority,
        submittedAt: inquiry.submittedAtISO,
      },
      property: { ...property },
      companyContext: {
        companyName: runtime.getCompany().companyName,
        officeName: runtime.getCompany().officeName ?? "",
        responsePolicy: responsePolicy || "Prompt, professional, governance-aware.",
      },
      runtime,
    } as any);

    const communicationId = `comm_${workItemId}`;
    const existingCommunication = (runtime.getCommunications?.() ?? []).find(
      (c: any) => c.communicationId === communicationId,
    );

    if (existingCommunication) {
      reviewWork.communication = existingCommunication;
    } else {
      const communicationEngine = new CommunicationEngine({ runtime });
      const draftContent = String(reviewWork?.draft?.content ?? "");
      const { subject, body } = parseSubjectAndBody(draftContent);

      const reviewRequired = Boolean(reviewWork?.approval?.requiresApproval);
      reviewWork.communication = communicationEngine.createDraft({
        communicationId,
        channel: "email",
        recipient: buyer.name,
        subject,
        body,
        reviewRequired,
        createdAtISO: inquiry.createdTimeISO,
      });
    }

    const comm = reviewWork.communication;
    if (comm?.status === "APPROVED") {
      reviewWork.caseSummary.status = "Completed";
      reviewWork.approval.requiresApproval = false;
      reviewWork.approval.primaryAction = "Approve";
      reviewWork.approval.statusLabel = "Completed";
      reviewWork.approval.governanceNote =
        "Governance decision recorded. The draft is approved within governance boundaries.";
    } else if (comm?.status === "FAILED") {
      reviewWork.caseSummary.status = "Completed";
      reviewWork.approval.requiresApproval = false;
      reviewWork.approval.primaryAction = "Reject";
      reviewWork.approval.statusLabel = "Rejected";
      reviewWork.approval.governanceNote =
        "Governance decision recorded. The draft is rejected and will require revised next steps.";
    }

    return reviewWork;
  }

  async applyReviewDecision(
    workItemId: string,
    decision: "APPROVE" | "REJECT",
  ) {
    const runtime = this.getRuntime();
    const communicationId = `comm_${workItemId}`;
    const communicationEngine = new CommunicationEngine({ runtime });

    const existing = (runtime.getCommunications?.() ?? []).find(
      (c: any) => c.communicationId === communicationId,
    );
    if (!existing) {
      await this.loadReviewWork(workItemId);
    }

    const completionTimeISO = new Date().toISOString();

    if (decision === "APPROVE") {
      communicationEngine.approveCommunication({
        communicationId,
        approvedBy: "Review Manager",
        approvedAtISO: completionTimeISO,
      });
    } else {
      communicationEngine.rejectCommunication({
        communicationId,
        rejectedBy: "Review Manager",
        rejectedAtISO: completionTimeISO,
      });
    }

    return this.loadReviewWork(workItemId);
  }

  async sendReviewCommunication(workItemId: string) {
    const runtime = this.getRuntime();
    const communicationId = `comm_${workItemId}`;
    const communicationEngine = new CommunicationEngine({ runtime });

    const existing = (runtime.getCommunications?.() ?? []).find(
      (c: any) => c.communicationId === communicationId,
    );
    if (!existing) {
      await this.loadReviewWork(workItemId);
    }

    const comm = communicationEngine.getCommunicationOrThrow(communicationId);
    if (comm.status !== "APPROVED") {
      throw new Error(
        `MockWorkspaceApi.sendReviewCommunication: cannot send in status=${comm.status}`,
      );
    }

    await communicationEngine.sendCommunication({
      communicationId,
      provider: new LocalWorkspaceEmailProvider(),
    });

    return this.loadReviewWork(workItemId);
  }
}

