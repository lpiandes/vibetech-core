/**
 * Vertical-agnostic specialty event catalog — shared by UI, LLM proposer, and fan-out.
 */
export const SPECIALTY_EVENT_CATALOG = Object.freeze([
  { id: "SPECIALTY_JOB_REQUESTED", label: "Manual run (you click Test)" },
  { id: "SPECIALTY_SCHEDULE_DUE", label: "Weekly / scheduled digest" },
  { id: "PIPELINE_STAGE_ENTERED", label: "Someone moves a pipeline card" },
  { id: "SCHEDULE_CHANGE", label: "Club calendar event created or changed" },
  { id: "EVENT_UPDATE", label: "Calendar event details updated" },
  { id: "EVENT_REMINDER_DUE", label: "Calendar reminder time reached" },
  { id: "ANNOUNCEMENT_REQUESTED", label: "Announcement requested" },
  { id: "NEW_INQUIRY", label: "New inquiry arrives" },
  { id: "INBOUND_VOICE_CALL", label: "Inbound phone call" },
  { id: "FORM_SUBMIT", label: "Form submitted" },
  { id: "META_LEAD", label: "Meta / Facebook lead" },
  { id: "INTERACTION_OUTCOME_RECORDED", label: "Interaction recorded" },
]);

export const SPECIALTY_EVENT_IDS = Object.freeze(
  SPECIALTY_EVENT_CATALOG.map((e) => e.id),
);

export function specialtyEventLabel(eventType) {
  const hit = SPECIALTY_EVENT_CATALOG.find((e) => e.id === String(eventType));
  return hit?.label ?? String(eventType ?? "").replace(/_/g, " ");
}
