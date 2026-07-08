import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { ConnectionEventEngine } from "./ConnectionEventEngine.js";

const DEFAULT_STATE = deepFreeze({
  connections: deepFreeze([]),
  actionHistory: deepFreeze([]),
  metrics: deepFreeze({ connectionCount: 0, connectedCount: 0, actionCount: 0 }),
});

export class ConnectionRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : DEFAULT_STATE;
    this._state = deepFreeze(this._state);
  }

  getConnections() {
    return this._state.connections;
  }

  getConnection(id) {
    const sid = String(id ?? "");
    return this._state.connections.find((c) => c.id === sid) ?? null;
  }

  getConnectionByType(connectionType) {
    const st = String(connectionType ?? "");
    return this._state.connections.find((c) => c.connectionType === st) ?? null;
  }

  getActionHistory() {
    return this._state.actionHistory;
  }

  getMetrics() {
    return this._state.metrics;
  }

  applyEvent(event) {
    this._state = {
      connections: [...this._state.connections],
      actionHistory: [...this._state.actionHistory],
      metrics: { ...this._state.metrics },
    };
    const engine = new ConnectionEventEngine({ runtime: this });
    engine.apply(event);
    this._state = deepFreeze(this._state);
    return this._state;
  }

  exportState() {
    return this._state;
  }
}
