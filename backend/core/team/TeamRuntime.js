import { buildDefaultTeamSeed } from "./TeamBuilder.js";
import { TeamEventEngine } from "./TeamEventEngine.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

export class TeamRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : buildDefaultTeamSeed();
    this._state = deepFreeze(this._state);
  }

  getMembers() {
    return this._state.members;
  }

  getDepartments() {
    return this._state.departments;
  }

  getRoles() {
    return this._state.roles;
  }

  getStatus() {
    return this._state.status;
  }

  getMetrics() {
    return this._state.metrics;
  }

  getRecommendations() {
    return this._state.recommendations;
  }

  applyEvent(event) {
    const engine = new TeamEventEngine({ runtime: this });
    engine.apply(event);
    // engine already deep-freezes derived state; keep deterministic invariants.
    this._state = deepFreeze(this._state);
    return this._state;
  }
}

