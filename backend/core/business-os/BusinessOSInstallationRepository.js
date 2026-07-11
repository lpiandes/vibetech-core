import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Repository port for durable Business OS installation facts.
 * In-memory implementation for tests; Postgres adapter wraps platformStore.
 */
export class BusinessOSInstallationRepository {
  constructor({ store = null } = {}) {
    this.store = store;
    this.specifications = new Map();
    this.installations = new Map();
    this.operations = new Map();
    this.approvals = new Map();
    this.dryRuns = new Map();
    this.capabilityGaps = new Map();
  }

  saveSpecification(specification) {
    const key = `${specification.businessId ?? "draft"}:${specification.specificationId}:v${specification.version ?? specification.specificationVersion}`;
    this.specifications.set(key, deepFreeze(specification));
    return this.specifications.get(key);
  }

  getSpecification({ businessId, specificationId, version }) {
    return this.specifications.get(`${businessId ?? "draft"}:${specificationId}:v${version}`) ?? null;
  }

  saveDryRun(dryRun) {
    this.dryRuns.set(`${dryRun.businessId}:${dryRun.planId}`, deepFreeze(dryRun));
    return this.dryRuns.get(`${dryRun.businessId}:${dryRun.planId}`);
  }

  getDryRun(businessId, planId) {
    return this.dryRuns.get(`${businessId}:${planId}`) ?? null;
  }

  saveApproval(approval) {
    this.approvals.set(`${approval.businessId}:${approval.approvalId}`, deepFreeze(approval));
    return this.approvals.get(`${approval.businessId}:${approval.approvalId}`);
  }

  getApproval(businessId, approvalId) {
    return this.approvals.get(`${businessId}:${approvalId}`) ?? null;
  }

  getInstallation(businessId) {
    return this.installations.get(String(businessId)) ?? null;
  }

  saveInstallation(record) {
    this.installations.set(String(record.businessId), deepFreeze(record));
    return this.installations.get(String(record.businessId));
  }

  saveOperationCheckpoint(businessId, operation) {
    const key = String(businessId);
    if (!this.operations.has(key)) this.operations.set(key, new Map());
    this.operations.get(key).set(operation.operationId ?? operation.actionId, deepFreeze(operation));
    return operation;
  }

  listOperationCheckpoints(businessId) {
    const map = this.operations.get(String(businessId));
    return map ? [...map.values()] : [];
  }

  saveCapabilityGap(businessId, gap) {
    const key = String(businessId);
    if (!this.capabilityGaps.has(key)) this.capabilityGaps.set(key, []);
    const list = [...this.capabilityGaps.get(key), deepFreeze(gap)];
    this.capabilityGaps.set(key, list);
    return gap;
  }

  listCapabilityGaps(businessId) {
    return this.capabilityGaps.get(String(businessId)) ?? [];
  }
}
