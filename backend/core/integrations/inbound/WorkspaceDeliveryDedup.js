import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Workspace-scoped webhook delivery deduplication.
 */
export class WorkspaceDeliveryDedup {
  constructor() {
    this._byWorkspace = new Map();
  }

  has(workspaceId, deliveryKey) {
    const set = this._byWorkspace.get(String(workspaceId));
    return set ? set.has(deliveryKey) : false;
  }

  add(workspaceId, deliveryKey) {
    const wid = String(workspaceId);
    if (!this._byWorkspace.has(wid)) this._byWorkspace.set(wid, new Set());
    this._byWorkspace.get(wid).add(deliveryKey);
  }
}

export const defaultWorkspaceDeliveryDedup = new WorkspaceDeliveryDedup();
