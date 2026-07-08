export type EngagementTimelineItem = {
  id: string;
  type: string;
  category: string;
  occurredAt: string;
  title: string;
  description: string;
  status: string | null;
  actor: string | null;
  relatedObjects: Record<string, unknown>[];
  sourceReference: { sourceType: string; sourceId: string };
  metadata: Record<string, unknown>;
};

export type EngagementAttentionItem = {
  id: string;
  category: string;
  summary: string;
  priority: string;
  relatedObjects: Record<string, unknown>[];
  recommendedNextAction: string | null;
  metadata: Record<string, unknown>;
};

export type EngagementNextAction = {
  id: string;
  actionType: string;
  title: string;
  description: string;
  priority: string;
  dueAt: string | null;
  ownerId: string | null;
  sourceType: string;
  sourceId: string;
  relatedObjects: Record<string, unknown>[];
  requiresApproval: boolean;
  status: string;
};

export type EngagementViewModel = {
  version: number;
  partyId: string;
  generatedAt: string;
  party: Record<string, unknown>;
  relationshipSummary: Record<string, unknown>[];
  currentContext: Record<string, unknown>;
  timeline: EngagementTimelineItem[];
  openWork: Record<string, unknown>[];
  openRequests: Record<string, unknown>[];
  communications: Record<string, unknown>[];
  interactions: Record<string, unknown>[];
  followUps: Record<string, unknown>[];
  pendingApprovals: Record<string, unknown>[];
  automationActivity: Record<string, unknown>[];
  attention: {
    summary: string;
    items: EngagementAttentionItem[];
  };
  nextActions: EngagementNextAction[];
  subjects: Record<string, unknown>[];
  communicationPreferences: {
    items: Record<string, unknown>[];
    contactable: { email: boolean; sms: boolean };
  };
  segmentMemberships: {
    segmentId: string;
    segmentName: string;
    reasons: string[];
  }[];
  qualificationSummary: Record<string, unknown>[];
  metrics: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type EngagementPartyIndexItem = {
  partyId: string;
  displayName: string;
  partyType: string;
  partyTypeLabel: string | null;
  email: string | null;
  phone: string | null;
  relationshipTypes: string[];
  relationshipLabels: string[];
  relationships?: {
    type: string;
    status: string;
    effectiveTo?: string | null;
  }[];
  partyStatus?: string;
  qualificationProfile?: Record<string, unknown>;
  primarySubjectId: string | null;
  primarySubjectName: string | null;
  subjectNames: string[];
  subjectCount: number;
  openRequestCount: number;
  openWorkCount: number;
  attentionLevel: string;
  lastActivityAt: string | null;
  lastActivityLabel: string | null;
  nextActionTitle: string | null;
  href: string;
};

export type PeopleFilterDefinition = {
  id: string;
  label: string;
  predicate: Record<string, unknown>;
};

export type EngagementPartyIndexViewModel = {
  generatedAt: string;
  peopleFilters?: PeopleFilterDefinition[];
  parties: EngagementPartyIndexItem[];
  relationshipFollowUps?: {
    generatedAt: string;
    candidates: {
      candidateId: string;
      partyId: string;
      displayName: string;
      relationshipType: string;
      relationshipLabel: string;
      ruleId: string;
      priority: string;
      reasonCode: string;
      reasonLabel: string;
      evidence?: Record<string, unknown>;
      latestMeaningfulActivityAt: string | null;
      existingOpenWorkId: string | null;
      latestCompletedMatchingWorkId: string | null;
      recurrenceBlockedUntil: string | null;
      contactability?: {
        email?: { permitted?: boolean; reason?: string | null };
        sms?: { permitted?: boolean; reason?: string | null };
      };
      targetWork?: Record<string, unknown>;
    }[];
  };
};
