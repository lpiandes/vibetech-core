import { MockWorkspaceApi } from "./MockWorkspaceApi";

export class WorkspaceService {
  // Interface must not change; we delegate to MockWorkspaceApi for now.
  private api: MockWorkspaceApi;

  constructor() {
    this.api = new MockWorkspaceApi();
  }

  loadDashboard() {
    return this.api.loadDashboard();
  }

  loadDigitalWorkforce() {
    return this.api.loadDigitalWorkforce();
  }

  loadWorkQueue() {
    return this.api.loadWorkQueue();
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

