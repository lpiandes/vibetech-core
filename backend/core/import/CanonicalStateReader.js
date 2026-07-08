import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Read-only facade over workspace runtimes. Never calls applyEvent or mutation APIs.
 */
export class CanonicalStateReader {
  constructor({ stack } = {}) {
    this.stack = stack;
  }

  readSnapshot() {
    const parties = (this.stack?.businessGraphRuntime?.getParties?.() ?? []).map((party) =>
      deepFreeze({
        id: String(party.id),
        partyType: String(party.partyType),
        displayName: String(party.displayName ?? ""),
        status: String(party.status ?? ""),
        contactMethods: [...(party.contactMethods ?? [])].map(String),
        externalReferences: [...(party.externalReferences ?? [])].map(String),
        metadata: party.metadata && typeof party.metadata === "object" ? { ...party.metadata } : {},
      }),
    );

    const relationships = this.stack?.businessGraphRuntime?.getRelationships?.() ?? [];
    const activeRelationshipTypesByPartyId = {};
    for (const rel of relationships) {
      if (String(rel.status) !== "active") continue;
      const fromId = String(rel.fromEntity?.entityId ?? "");
      const toId = String(rel.toEntity?.entityId ?? "");
      for (const partyId of [fromId, toId]) {
        if (!partyId.startsWith("party")) continue;
        if (!activeRelationshipTypesByPartyId[partyId]) activeRelationshipTypesByPartyId[partyId] = [];
        activeRelationshipTypesByPartyId[partyId].push(String(rel.relationshipType));
      }
    }

    const preferencesByPartyId = {};
    for (const party of parties) {
      const prefs = this.stack?.communicationPreferenceRuntime?.getPreferencesForParty?.(party.id) ?? [];
      preferencesByPartyId[party.id] = prefs.map((p) => ({
        channel: String(p.channel),
        scope: String(p.scope),
        status: String(p.status),
        source: String(p.source ?? ""),
        recordedAt: String(p.recordedAt ?? ""),
      }));
    }

    const importProfileRequestsByPartyId = {};
    const requests = this.stack?.requestRuntime?.getRequests?.() ?? [];
    for (const req of requests) {
      if (String(req.requestType) !== "crm_import_profile") continue;
      const partyId = String(req.requester ?? "");
      if (!partyId) continue;
      importProfileRequestsByPartyId[partyId] = {
        requestId: String(req.id),
        qualification: req.metadata?.qualification ?? {},
      };
    }

    return deepFreeze({
      parties,
      activeRelationshipTypesByPartyId: deepFreeze(activeRelationshipTypesByPartyId),
      preferencesByPartyId: deepFreeze(preferencesByPartyId),
      importProfileRequestsByPartyId: deepFreeze(importProfileRequestsByPartyId),
    });
  }

  exportRuntimeHashes({ exportRuntimeSnapshots, kinds }) {
    const snapshots = exportRuntimeSnapshots({
      stack: this.stack,
      integrationPlatform: null,
      kinds,
    });
    const hashes = {};
    for (const snap of snapshots) {
      hashes[snap.kind] = JSON.stringify(snap.state);
    }
    return hashes;
  }
}
