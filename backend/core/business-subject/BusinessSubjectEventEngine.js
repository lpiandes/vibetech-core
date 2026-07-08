import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBusinessSubject } from "./BusinessSubject.js";
import {
  BUSINESS_SUBJECT_EVENT_TYPES,
  SUPPORTED_BUSINESS_SUBJECT_EVENT_TYPES,
} from "./BusinessSubjectEventTypes.js";

export class BusinessSubjectEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("BusinessSubjectEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event?.id || !event?.type || !event?.timestampISO) {
      throw new Error("BusinessSubjectEventEngine: invalid event.");
    }
    if (!SUPPORTED_BUSINESS_SUBJECT_EVENT_TYPES.includes(event.type)) {
      throw new Error(`BusinessSubjectEventEngine: unsupported type: ${event.type}`);
    }

    const prev = this.runtime._state;
    const subjects = [...(prev.subjects ?? [])];
    const payload = event.payload ?? {};

    switch (event.type) {
      case BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED: {
        const built = createBusinessSubject(payload.subject);
        if (subjects.some((s) => String(s.id) === String(built.id))) {
          throw new Error(`SUBJECT_CREATED: already exists: ${built.id}`);
        }
        subjects.push(built);
        break;
      }
      case BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_UPDATED: {
        const id = String(payload.subjectId);
        const idx = subjects.findIndex((s) => String(s.id) === id);
        if (idx === -1) throw new Error(`SUBJECT_UPDATED: not found: ${id}`);
        const prevSubject = subjects[idx];
        const patch = payload.patch ?? {};
        subjects[idx] = createBusinessSubject({
          ...prevSubject,
          ...patch,
          id,
          keyAttributes: { ...prevSubject.keyAttributes, ...(patch.keyAttributes ?? {}) },
          updatedAt: event.timestampISO,
        });
        break;
      }
      case BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_ARCHIVED: {
        const id = String(payload.subjectId);
        const idx = subjects.findIndex((s) => String(s.id) === id);
        if (idx === -1) throw new Error(`SUBJECT_ARCHIVED: not found: ${id}`);
        subjects[idx] = createBusinessSubject({
          ...subjects[idx],
          status: "archived",
          updatedAt: event.timestampISO,
        });
        break;
      }
      default:
        break;
    }

    this.runtime._state = deepFreeze({
      ...prev,
      subjects: deepFreeze(subjects),
      metrics: deepFreeze({ subjectCount: subjects.filter((s) => s.status !== "archived").length }),
    });
    return this.runtime._state;
  }
}
