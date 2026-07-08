import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createSegmentDefinition } from "./SegmentDefinition.js";
import { SEGMENT_EVENT_TYPES } from "./SegmentDefinition.js";

const DEFAULT_STATE = deepFreeze({ definitions: deepFreeze([]) });

export class SegmentDefinitionRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : DEFAULT_STATE;
    this._state = deepFreeze(this._state);
  }

  getDefinitions() {
    return this._state.definitions;
  }

  getDefinition(id) {
    return this._state.definitions.find((d) => String(d.id) === String(id)) ?? null;
  }

  applyEvent(event) {
    const definitions = [...this._state.definitions];
    if (event.type === SEGMENT_EVENT_TYPES.SEGMENT_REGISTERED) {
      const def = createSegmentDefinition(event.payload.definition);
      const idx = definitions.findIndex((d) => String(d.id) === String(def.id));
      if (idx >= 0) definitions[idx] = def;
      else definitions.push(def);
    }
    if (event.type === SEGMENT_EVENT_TYPES.SEGMENT_ARCHIVED) {
      const id = String(event.payload.definitionId);
      const idx = definitions.findIndex((d) => String(d.id) === id);
      if (idx >= 0) {
        definitions[idx] = createSegmentDefinition({ ...definitions[idx], status: "archived" });
      }
    }
    this._state = deepFreeze({ definitions: deepFreeze(definitions) });
    return this._state;
  }
}
