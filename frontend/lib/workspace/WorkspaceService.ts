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
}

