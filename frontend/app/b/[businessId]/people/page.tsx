import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import ModuleRenderer from "@/components/workspace/ModuleRenderer";
import ContactsCrmPanel from "@/components/people/ContactsCrmPanel";

/**
 * One People surface: CRM roster (add/edit/delete) with links into person detail.
 */
export default async function PeoplePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await getAuthorizedWorkspace(businessId);
  return (
    <ModuleRenderer moduleId="people">
      <div style={{ display: "grid", gap: 24, width: "100%", maxWidth: 1400, margin: "0 auto" }}>
        <ContactsCrmPanel businessId={businessId} />
      </div>
    </ModuleRenderer>
  );
}
