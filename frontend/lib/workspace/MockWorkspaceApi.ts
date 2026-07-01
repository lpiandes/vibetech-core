import { CompanyWorkspaceRuntime } from "../../../backend/core/company/CompanyWorkspaceRuntime.js";
import { WorkspaceViewAdapter } from "../../../backend/core/views/WorkspaceViewAdapter.js";
import { COMPANY_EVENT_TYPES } from "../../../backend/core/company/events/CompanyEventTypes.js";
import { createCompanyEvent } from "../../../backend/core/company/events/CompanyEvent.js";

export class MockWorkspaceApi {
  private static runtime: CompanyWorkspaceRuntime | null = null;
  private static adapter: WorkspaceViewAdapter | null = null;
  private static hasAppliedDemoInquiryEvent = false;

  private getAdapter() {
    if (!MockWorkspaceApi.runtime || !MockWorkspaceApi.adapter) {
      MockWorkspaceApi.runtime = new CompanyWorkspaceRuntime();
      MockWorkspaceApi.adapter = new WorkspaceViewAdapter({
        runtime: MockWorkspaceApi.runtime,
      });

      // Seed the in-memory runtime with one website inquiry event so that
      // Dashboard / Activity timeline / Work Queue reflect "after demo intake".
      //
      // This uses the existing event model + engine (no duplicated state derivation).
      if (!MockWorkspaceApi.hasAppliedDemoInquiryEvent) {
        const event = createCompanyEvent({
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

        MockWorkspaceApi.runtime.applyEvent(event);
        MockWorkspaceApi.hasAppliedDemoInquiryEvent = true;
      }
    }
    return MockWorkspaceApi.adapter;
  }

  loadDashboard() {
    const adapter = this.getAdapter();
    return adapter.getDashboardView();
  }

  loadDigitalWorkforce() {
    const adapter = this.getAdapter();
    return adapter.getDigitalWorkforceView();
  }

  loadWorkQueue() {
    const adapter = this.getAdapter();
    return adapter.getWorkQueueView();
  }
}

