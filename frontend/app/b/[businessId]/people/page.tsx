import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import ModuleRenderer from "@/components/workspace/ModuleRenderer";
import ContactsCrmPanel from "@/components/people/ContactsCrmPanel";
import RelationshipFollowUpQueue from "@/components/people/RelationshipFollowUpQueue";

/**
 * One People surface: CRM roster + relationship follow-ups when available.
 */
export default async function PeoplePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getAuthorizedWorkspace(businessId);

  let followUpCandidates: any[] = [];
  try {
    const followUps = (ctx.service as any)?.loadRelationshipFollowUps?.({ includeProductContext: false });
    followUpCandidates = Array.isArray(followUps?.candidates) ? followUps.candidates : [];
  } catch {
    followUpCandidates = [];
  }

  return (
    <ModuleRenderer moduleId="people">
      <div style={{ display: "grid", gap: 24, width: "100%", maxWidth: 1400, margin: "0 auto" }}>
        {followUpCandidates.length > 0 ? (
          <RelationshipFollowUpQueue businessId={businessId} candidates={followUpCandidates} />
        ) : null}
        <ContactsCrmPanel businessId={businessId} />
      </div>
    </ModuleRenderer>
  );
}
