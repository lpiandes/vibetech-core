export const IMPORT_RUN_STATUSES = Object.freeze({
  UPLOADED: "uploaded",
  INSPECTED: "inspected",
  MAPPED: "mapped",
  DRY_RUN_COMPLETE: "dry_run_complete",
  DRY_RUN_FAILED: "dry_run_failed",
  // S1-2B reserved — not reachable in S1-2A
  COMMIT_IN_PROGRESS: "commit_in_progress",
  COMMITTED: "committed",
  COMMIT_FAILED: "commit_failed",
  COMMIT_PARTIALLY_FAILED: "commit_partially_failed",
});

export const IMPORT_PLAN_ACTION_TYPES = Object.freeze({
  CREATE_PARTY: "CREATE_PARTY",
  UPDATE_PARTY: "UPDATE_PARTY",
  ADD_RELATIONSHIP: "ADD_RELATIONSHIP",
  PROMOTE_RELATIONSHIP: "PROMOTE_RELATIONSHIP",
  RECORD_QUALIFICATION: "RECORD_QUALIFICATION",
  RECORD_CONSENT: "RECORD_CONSENT",
  RECORD_NOTE: "RECORD_NOTE",
  CREATE_SUBJECT: "CREATE_SUBJECT",
  UPDATE_SUBJECT: "UPDATE_SUBJECT",
  LINK_PARTY_TO_SUBJECT: "LINK_PARTY_TO_SUBJECT",
  SKIP: "SKIP",
  REVIEW: "REVIEW",
});

export const IMPORT_MATCH_TIERS = Object.freeze({
  EXTERNAL_REF: "external_ref",
  EMAIL: "email",
  PHONE: "phone",
  NAME_SUGGESTED: "name_suggested",
  NEW: "new",
});

export const IMPORT_ROW_OUTCOME_STATUSES = Object.freeze({
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  SKIPPED: "skipped",
  REVIEW: "review",
});

export const IMPORT_ROW_COMMIT_STATUSES = Object.freeze({
  PENDING: "pending",
  COMMITTED: "committed",
  SKIPPED: "skipped",
  FAILED: "failed",
});

export const CANONICAL_CONTACT_FIELDS = Object.freeze([
  "externalContactId",
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "status",
  "tags",
  "clientType",
  "leadSource",
  "assignedAgentName",
  "notes",
  "createdDate",
  "updatedDate",
  "relationshipType",
  "lifecycleFrom",
  "lifecycleTo",
  "emailOptIn",
  "emailOptOut",
  "smsOptIn",
  "smsOptOut",
  "doNotContact",
  "consentSource",
  "consentTimestamp",
]);
