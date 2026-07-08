import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`EngagementViewModel: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createEngagementViewModel({
  version,
  partyId,
  generatedAt,
  party,
  relationshipSummary,
  currentContext,
  timeline,
  openWork,
  openRequests,
  communications,
  interactions,
  followUps,
  pendingApprovals,
  automationActivity,
  attention,
  nextActions,
  subjects = [],
  communicationPreferences = null,
  segmentMemberships = [],
  qualificationSummary = [],
  metrics,
  metadata,
} = {}) {
  if (!partyId || typeof partyId !== "string") fail("partyId required.");
  if (!generatedAt || typeof generatedAt !== "string") fail("generatedAt required.");
  if (!party || typeof party !== "object") fail("party required.");
  if (!Array.isArray(timeline)) fail("timeline required.");
  if (!attention || !isPlainObject(attention)) fail("attention required.");
  if (!Array.isArray(nextActions)) fail("nextActions required.");

  return deepFreeze({
    version: Number(version ?? 1),
    partyId: String(partyId),
    generatedAt: String(generatedAt),
    party: deepFreeze(party),
    relationshipSummary: deepFreeze(Array.isArray(relationshipSummary) ? relationshipSummary : []),
    currentContext: currentContext && isPlainObject(currentContext) ? deepFreeze(currentContext) : deepFreeze({}),
    timeline: deepFreeze(timeline),
    openWork: deepFreeze(Array.isArray(openWork) ? openWork : []),
    openRequests: deepFreeze(Array.isArray(openRequests) ? openRequests : []),
    communications: deepFreeze(Array.isArray(communications) ? communications : []),
    interactions: deepFreeze(Array.isArray(interactions) ? interactions : []),
    followUps: deepFreeze(Array.isArray(followUps) ? followUps : []),
    pendingApprovals: deepFreeze(Array.isArray(pendingApprovals) ? pendingApprovals : []),
    automationActivity: deepFreeze(Array.isArray(automationActivity) ? automationActivity : []),
    attention: deepFreeze(attention),
    nextActions: deepFreeze(nextActions),
    subjects: deepFreeze(Array.isArray(subjects) ? subjects : []),
    communicationPreferences:
      communicationPreferences && isPlainObject(communicationPreferences)
        ? deepFreeze(communicationPreferences)
        : deepFreeze({ items: [], contactable: { email: true, sms: true } }),
    segmentMemberships: deepFreeze(Array.isArray(segmentMemberships) ? segmentMemberships : []),
    qualificationSummary: deepFreeze(Array.isArray(qualificationSummary) ? qualificationSummary : []),
    metrics: metrics && isPlainObject(metrics) ? deepFreeze(metrics) : deepFreeze({}),
    metadata: metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  });
}
