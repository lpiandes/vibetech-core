import crypto from "node:crypto";

import { BUSINESS_SUBJECT_EVENT_TYPES } from "./BusinessSubjectEventTypes.js";
import { createBusinessSubject } from "./BusinessSubject.js";

function requireString(v, name) {
  if (!v || typeof v !== "string") throw new Error(`RecordBusinessSubjectService: ${name} required string.`);
  return String(v);
}

/**
 * Create a canonical business subject (property, listing, unit, matter, SKU, etc.).
 */
export class RecordBusinessSubjectService {
  execute({
    businessSubjectRuntime,
    workspaceId,
    subjectInput,
    nowISO,
    source = "record_business_subject",
  } = {}) {
    if (!businessSubjectRuntime) {
      throw new Error("RecordBusinessSubjectService: businessSubjectRuntime required.");
    }

    const effectiveNowISO = requireString(nowISO ?? new Date().toISOString(), "nowISO");
    const effectiveWorkspaceId = requireString(workspaceId, "workspaceId");
    const input = subjectInput ?? {};

    const subjectType = requireString(input.subjectType, "subjectType");
    const displayName = requireString(input.displayName, "displayName");
    const id = input.id ? String(input.id) : `subj_${crypto.randomUUID()}`;

    if (businessSubjectRuntime.getSubject(id)) {
      throw new Error(`RecordBusinessSubjectService: subject already exists: ${id}`);
    }

    const subject = createBusinessSubject({
      id,
      workspaceId: effectiveWorkspaceId,
      subjectType,
      displayName,
      status: input.status ?? "active",
      keyAttributes: input.keyAttributes ?? {},
      externalReferences: Array.isArray(input.externalReferences) ? input.externalReferences.map(String) : [],
      createdAt: effectiveNowISO,
      updatedAt: effectiveNowISO,
    });

    businessSubjectRuntime.applyEvent({
      id: `evt_subject_created_${id}`,
      timestampISO: effectiveNowISO,
      type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
      source,
      payload: { subject },
    });

    return businessSubjectRuntime.getSubject(id);
  }
}
