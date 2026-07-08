import { BUSINESS_SUBJECT_EVENT_TYPES } from "./BusinessSubjectEventTypes.js";

function requireString(v, name) {
  if (!v || typeof v !== "string") throw new Error(`updateBusinessSubjectStatus: ${name} required string.`);
  return String(v);
}

export function updateBusinessSubjectStatus({
  businessSubjectRuntime,
  subjectId,
  status,
  nowISO,
  source = "update_business_subject_status",
} = {}) {
  if (!businessSubjectRuntime) {
    throw new Error("updateBusinessSubjectStatus: businessSubjectRuntime required.");
  }

  const id = requireString(subjectId, "subjectId");
  const nextStatus = requireString(status, "status");
  const effectiveNowISO = requireString(nowISO ?? new Date().toISOString(), "nowISO");

  if (!businessSubjectRuntime.getSubject(id)) {
    throw new Error(`updateBusinessSubjectStatus: subject not found: ${id}`);
  }

  businessSubjectRuntime.applyEvent({
    id: `evt_subject_status_${id}_${nextStatus}`,
    timestampISO: effectiveNowISO,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_UPDATED,
    source,
    payload: {
      subjectId: id,
      patch: { status: nextStatus },
    },
  });

  return businessSubjectRuntime.getSubject(id);
}
