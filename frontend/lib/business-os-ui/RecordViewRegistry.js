export const RECORD_VIEW_TYPES = Object.freeze([
  "summary",
  "timeline",
  "related_work",
  "notes",
  "files",
]);

export function isRegisteredRecordView(type) {
  return RECORD_VIEW_TYPES.includes(String(type));
}
