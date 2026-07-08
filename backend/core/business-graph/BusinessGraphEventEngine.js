import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { BUSINESS_GRAPH_EVENT_TYPES, SUPPORTED_BUSINESS_GRAPH_EVENT_TYPES } from "./BusinessGraphEventTypes.js";

import { createBusinessParty } from "./BusinessParty.js";
import { createBusinessRelationship } from "./BusinessRelationship.js";

export class BusinessGraphEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("BusinessGraphEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") throw new Error("BusinessGraphEventEngine: event required.");
    if (!event.id || typeof event.id !== "string") throw new Error("BusinessGraphEventEngine: event.id required string.");
    if (!event.timestampISO || typeof event.timestampISO !== "string") throw new Error("BusinessGraphEventEngine: event.timestampISO required string.");
    if (!event.type || typeof event.type !== "string") throw new Error("BusinessGraphEventEngine: event.type required string.");
    if (!event.source || typeof event.source !== "string") throw new Error("BusinessGraphEventEngine: event.source required string.");
    if (!event.payload || typeof event.payload !== "object") throw new Error("BusinessGraphEventEngine: event.payload required.");

    if (!SUPPORTED_BUSINESS_GRAPH_EVENT_TYPES.includes(event.type)) {
      throw new Error(`BusinessGraphEventEngine: Unsupported event type: ${event.type}`);
    }

    const prev = this.runtime._state;
    const parties = [...(prev.parties ?? [])];
    const relationships = [...(prev.relationships ?? [])];

    const payload = event.payload;

    switch (event.type) {
      case BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED: {
        const party = payload.party;
        const built = createBusinessParty(party);
        if (parties.some((p) => String(p.id) === String(built.id))) {
          throw new Error(`PARTY_CREATED: party already exists: ${String(built.id)}`);
        }
        parties.push(built);
        break;
      }

      case BUSINESS_GRAPH_EVENT_TYPES.PARTY_UPDATED: {
        const { partyId, patch } = payload;
        const id = String(partyId);
        const idx = parties.findIndex((p) => String(p.id) === id);
        if (idx === -1) throw new Error(`PARTY_UPDATED: party does not exist: ${id}`);
        const prevParty = parties[idx];
        const merged = createBusinessParty({
          ...prevParty,
          ...(patch && typeof patch === "object" ? patch : {}),
          id,
          updatedAt: event.timestampISO,
        });
        parties[idx] = merged;
        break;
      }

      case BUSINESS_GRAPH_EVENT_TYPES.PARTY_ARCHIVED: {
        const { partyId } = payload;
        const id = String(partyId);
        const idx = parties.findIndex((p) => String(p.id) === id);
        if (idx === -1) throw new Error(`PARTY_ARCHIVED: party does not exist: ${id}`);
        const prevParty = parties[idx];
        parties[idx] = createBusinessParty({
          ...prevParty,
          status: "archived",
          updatedAt: event.timestampISO,
        });
        break;
      }

      case BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED: {
        const relationship = payload.relationship;
        const built = createBusinessRelationship(relationship);
        if (relationships.some((r) => String(r.id) === String(built.id))) {
          throw new Error(`RELATIONSHIP_CREATED: relationship already exists: ${String(built.id)}`);
        }
        relationships.push(built);
        break;
      }

      case BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_UPDATED: {
        const { relationshipId, patch } = payload;
        const id = String(relationshipId);
        const idx = relationships.findIndex((r) => String(r.id) === id);
        if (idx === -1) throw new Error(`RELATIONSHIP_UPDATED: relationship does not exist: ${id}`);
        const prevRel = relationships[idx];
        const merged = createBusinessRelationship({
          ...prevRel,
          ...(patch && typeof patch === "object" ? patch : {}),
          id,
          updatedAt: event.timestampISO,
        });
        relationships[idx] = merged;
        break;
      }

      case BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_ENDED: {
        const { relationshipId } = payload;
        const id = String(relationshipId);
        const idx = relationships.findIndex((r) => String(r.id) === id);
        if (idx === -1) throw new Error(`RELATIONSHIP_ENDED: relationship does not exist: ${id}`);
        const prevRel = relationships[idx];
        relationships[idx] = createBusinessRelationship({
          ...prevRel,
          status: "ended",
          effectiveTo: event.timestampISO,
          updatedAt: event.timestampISO,
        });
        break;
      }

      default:
        throw new Error(`BusinessGraphEventEngine: Unhandled event type: ${event.type}`);
    }

    const nextState = deepFreeze({
      ...prev,
      parties: deepFreeze(parties),
      relationships: deepFreeze(relationships),
    });
    this.runtime._state = nextState;
  }
}
