import { platformStore } from "./persistence/platformStore.js";
import { businessRecordToActivation } from "./persistence/platformMappers.js";

/**
 * PostgreSQL-backed business registry. JSON fallback removed.
 */
export class BusinessRegistry {
  async list() {
    return platformStore.listBusinesses();
  }

  listSync() {
    throw new Error("BusinessRegistry.listSync() removed — use async list() with PostgreSQL.");
  }

  async getById(businessId) {
    return platformStore.getBusinessById(businessId);
  }

  getByIdSync(businessId) {
    throw new Error("BusinessRegistry.getByIdSync() removed — use async getById().");
  }

  async getByWorkspaceId(workspaceId) {
    return platformStore.getBusinessById(workspaceId);
  }

  getByWorkspaceIdSync(workspaceId) {
    throw new Error("BusinessRegistry.getByWorkspaceIdSync() removed — use async getByWorkspaceId().");
  }

  async save(record) {
    const existing = await platformStore.getBusinessById(record.id);
    if (existing) {
      throw new Error("BusinessRegistry.save() update not supported — use platform store directly.");
    }
    return platformStore.createBusiness(record);
  }
}

export const businessRegistry = new BusinessRegistry();

export function businessRecordToActivationExport(record) {
  return businessRecordToActivation(record);
}

export { businessRecordToActivation };
