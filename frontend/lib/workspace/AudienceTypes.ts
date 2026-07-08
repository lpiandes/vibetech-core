export type AudienceMemberViewModel = {
  partyId: string;
  displayName: string;
  matchReasons: string[];
  contactability: {
    email: string;
    sms: string;
    contactable: boolean;
  };
};

export type AudienceSummaryViewModel = {
  segmentId: string;
  segmentName: string;
  purpose: string;
  targetEntityType: string;
  memberCount: number;
  contactableCount: number;
  blockedCount: number;
  members: AudienceMemberViewModel[];
};

export type AudienceDashboardViewModel = {
  generatedAt: string;
  audiences: AudienceSummaryViewModel[];
  productContext?: Record<string, unknown>;
};
