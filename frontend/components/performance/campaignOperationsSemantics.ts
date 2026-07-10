export function buildCampaignWorkReviewHref(businessId: unknown, workId: unknown) {
  const bid = String(businessId ?? "").trim();
  const wid = String(workId ?? "").trim();
  if (!bid || !wid) return null;
  return `/b/${encodeURIComponent(bid)}/work?workId=${encodeURIComponent(wid)}`;
}

export function canPrepareCampaignTemplate(template: { requiresSubject?: boolean } | null | undefined, selectedSubjectId: unknown) {
  if (!template?.requiresSubject) return true;
  return String(selectedSubjectId ?? "").trim().length > 0;
}

export function campaignPrepareDisabledReason(template: { requiresSubject?: boolean } | null | undefined, selectedSubjectId: unknown) {
  if (canPrepareCampaignTemplate(template, selectedSubjectId)) return null;
  return "Select a property to prepare this campaign.";
}
