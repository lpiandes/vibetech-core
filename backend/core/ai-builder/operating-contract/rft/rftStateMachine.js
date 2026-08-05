import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import {
  RFT_STATE_SET,
  RFT_STATES,
  hasProviderProof,
  normalizeRftEvidence,
} from "./rftCatalog.js";

/**
 * Pure RFT state machine: transitions, event mapping, proof-gated Verified.
 */

/** Allowed from → to transitions (Exception reachable from most open states). */
const TRANSITIONS = deepFreeze({
  Detected: ["ContextReady", "Exception", "Closed"],
  ContextReady: ["ActionProposed", "Exception", "Closed"],
  ActionProposed: ["ApprovalRequired", "AutoEligible", "Exception", "Closed"],
  ApprovalRequired: ["Executing", "ActionProposed", "Exception", "Closed"],
  AutoEligible: ["Executing", "Exception", "Closed"],
  Executing: ["WaitingExternally", "Verified", "Exception", "Closed"],
  WaitingExternally: ["Executing", "Verified", "Exception", "Closed"],
  Verified: ["OutcomeRecorded", "Exception", "Closed"],
  Exception: ["ContextReady", "ActionProposed", "ApprovalRequired", "Executing", "Closed"],
  OutcomeRecorded: ["Closed", "Exception"],
  Closed: [],
});

/** Default next state when an RFT event fires (may be overridden by explicit toState). */
const EVENT_TO_STATE = deepFreeze({
  WEBSITE_INQUIRY: "Detected",
  META_LEAD: "Detected",
  INBOUND_SALES_EMAIL: "Detected",
  MISSED_SALES_CALL: "Detected",
  CONTEXT_ENRICHED: "ContextReady",
  ACTION_PROPOSED: "ActionProposed",
  APPROVAL_GRANTED: "Executing",
  APPROVAL_REJECTED: "Exception",
  EXTERNAL_ACTION_STARTED: "Executing",
  EXTERNAL_WAIT: "WaitingExternally",
  PROSPECT_REPLIED: "WaitingExternally",
  MEETING_BOOKED: "Executing",
  MEETING_COMPLETED: "ActionProposed",
  PROPOSAL_SENT: "WaitingExternally",
  PROPOSAL_INACTIVE: "Exception",
  OPPORTUNITY_WON: "Executing",
  OPPORTUNITY_LOST: "OutcomeRecorded",
  PROOF_ATTACHED: null, // stay; may unlock Verified when progressing
  EXCEPTION_RAISED: "Exception",
  EXCEPTION_RESOLVED: "ActionProposed",
  OUTCOME_RECORDED: "OutcomeRecorded",
  CLOSED: "Closed",
});

export function listAllowedTransitions(fromState) {
  const key = String(fromState ?? "");
  return Object.freeze([...(TRANSITIONS[key] ?? [])]);
}

export function canTransition(fromState, toState) {
  const from = String(fromState ?? "");
  const to = String(toState ?? "");
  if (!RFT_STATE_SET.has(from) || !RFT_STATE_SET.has(to)) return false;
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function resolveTargetState({ fromState, eventType = null, toState = null } = {}) {
  if (toState != null && String(toState).trim()) {
    return String(toState).trim();
  }
  const mapped = EVENT_TO_STATE[String(eventType ?? "")];
  if (mapped) return mapped;
  return fromState;
}

/**
 * Verify gate: cannot enter Verified without at least one provider-backed evidence id.
 */
export function assertVerifiedAllowed({ toState, evidence = [] } = {}) {
  if (String(toState) !== "Verified") {
    return { ok: true };
  }
  if (!hasProviderProof(evidence)) {
    return {
      ok: false,
      code: "missing_provider_proof",
      message:
        "Cannot mark Verified without provider-backed evidence (message id, calendar id, CRM record id, etc.).",
    };
  }
  return { ok: true };
}

/**
 * Apply a transition. Returns a frozen result; never fabricates Verified.
 */
export function applyRftTransition({
  fromState,
  toState = null,
  eventType = null,
  evidence = [],
  actorId = null,
  at = null,
  note = null,
} = {}) {
  const from = RFT_STATE_SET.has(String(fromState)) ? String(fromState) : "Detected";
  const target = resolveTargetState({ fromState: from, eventType, toState });

  if (!RFT_STATE_SET.has(target)) {
    return deepFreeze({
      ok: false,
      code: "invalid_state",
      message: `Unknown RFT state: ${target}`,
      fromState: from,
      toState: from,
    });
  }

  if (!canTransition(from, target)) {
    return deepFreeze({
      ok: false,
      code: "illegal_transition",
      message: `Cannot transition from ${from} to ${target}`,
      fromState: from,
      toState: from,
      allowed: listAllowedTransitions(from),
    });
  }

  const normalizedEvidence = (Array.isArray(evidence) ? evidence : [])
    .map((e) => normalizeRftEvidence(e))
    .filter(Boolean);

  const proofGate = assertVerifiedAllowed({ toState: target, evidence: normalizedEvidence });
  if (!proofGate.ok) {
    return deepFreeze({
      ok: false,
      code: proofGate.code,
      message: proofGate.message,
      fromState: from,
      toState: from,
      evidence: normalizedEvidence,
    });
  }

  const timestamp = at ?? new Date().toISOString();
  return deepFreeze({
    ok: true,
    fromState: from,
    toState: target,
    eventType: eventType ? String(eventType) : null,
    evidence: normalizedEvidence,
    actorId: actorId ? String(actorId) : null,
    at: timestamp,
    note: note ? String(note).trim() : null,
    transition: {
      from: from,
      to: target,
      eventType: eventType ? String(eventType) : null,
      actorId: actorId ? String(actorId) : null,
      at: timestamp,
      note: note ? String(note).trim() : null,
    },
  });
}

export function initialRftOpportunityState({
  contractVersion = null,
  contentHash = null,
  triggerEvent = null,
  at = null,
} = {}) {
  const timestamp = at ?? new Date().toISOString();
  return deepFreeze({
    state: "Detected",
    contractKind: "revenue_follow_through",
    contractVersion: contractVersion ? String(contractVersion) : null,
    contentHash: contentHash ? String(contentHash) : null,
    triggerEvent: triggerEvent ? String(triggerEvent) : null,
    evidence: [],
    history: [
      {
        from: null,
        to: "Detected",
        eventType: triggerEvent ? String(triggerEvent) : "WEBSITE_INQUIRY",
        actorId: "system",
        at: timestamp,
        note: "Opportunity detected",
      },
    ],
    outcomeType: null,
    lastTransitionAt: timestamp,
    createdAt: timestamp,
  });
}

export { TRANSITIONS as RFT_TRANSITIONS, EVENT_TO_STATE as RFT_EVENT_TO_STATE, RFT_STATES };
