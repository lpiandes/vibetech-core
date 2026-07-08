import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { BusinessSubjectEventEngine } from "./BusinessSubjectEventEngine.js";
import { validateBusinessSubjectRuntime } from "./BusinessSubjectValidator.js";

const DEFAULT_STATE = deepFreeze({
  subjects: deepFreeze([]),
  metrics: deepFreeze({ subjectCount: 0 }),
});

export class BusinessSubjectRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : DEFAULT_STATE;
    this._state = deepFreeze(this._state);
    validateBusinessSubjectRuntime(this);
  }

  getSubjects() {
    return this._state.subjects;
  }

  getSubject(id) {
    const sid = String(id);
    return this._state.subjects.find((s) => String(s.id) === sid) ?? null;
  }

  getSubjectsByType(subjectType) {
    const st = String(subjectType);
    return this._state.subjects.filter((s) => String(s.subjectType) === st);
  }

  applyEvent(event) {
    const engine = new BusinessSubjectEventEngine({ runtime: this });
    engine.apply(event);
    validateBusinessSubjectRuntime(this);
    return this._state;
  }

  exportState() {
    return this._state;
  }
}
