export const RECORD_VIEW_TYPES = [
  "summary",
  "timeline",
  "related_work",
  "notes",
  "files",
] as const;

export function isRegisteredRecordView(type: string) {
  return (RECORD_VIEW_TYPES as readonly string[]).includes(type);
}
