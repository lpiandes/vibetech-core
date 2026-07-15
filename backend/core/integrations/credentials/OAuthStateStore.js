import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { randomBytes } from "node:crypto";

/**
 * Short-lived OAuth CSRF state store (in-process).
 */
export class OAuthStateStore {
  constructor({ ttlMs = 15 * 60 * 1000 } = {}) {
    this._ttlMs = Number(ttlMs) || 15 * 60 * 1000;
    this._byState = new Map();
  }

  create({ businessId, connectionType, providerType, redirectPath = null, metadata = {} } = {}) {
    const state = randomBytes(24).toString("hex");
    const record = {
      state,
      businessId: String(businessId ?? ""),
      connectionType: String(connectionType ?? ""),
      providerType: String(providerType ?? ""),
      redirectPath: redirectPath ? String(redirectPath) : null,
      metadata: metadata && typeof metadata === "object" ? { ...metadata } : {},
      createdAt: Date.now(),
    };
    this._byState.set(state, record);
    return deepFreeze({
      state: record.state,
      businessId: record.businessId,
      connectionType: record.connectionType,
      providerType: record.providerType,
      redirectPath: record.redirectPath,
    });
  }

  consume(state) {
    const key = String(state ?? "");
    const record = this._byState.get(key);
    if (!record) return null;
    this._byState.delete(key);
    if (Date.now() - record.createdAt > this._ttlMs) return null;
    return {
      state: record.state,
      businessId: record.businessId,
      connectionType: record.connectionType,
      providerType: record.providerType,
      redirectPath: record.redirectPath,
      metadata: { ...record.metadata },
    };
  }

  peek(state) {
    return this._byState.get(String(state ?? "")) ?? null;
  }
}

let sharedOAuthStateStore = null;

export function getSharedOAuthStateStore() {
  if (!sharedOAuthStateStore) sharedOAuthStateStore = new OAuthStateStore();
  return sharedOAuthStateStore;
}

export function resetSharedOAuthStateStoreForTests() {
  sharedOAuthStateStore = new OAuthStateStore();
  return sharedOAuthStateStore;
}
