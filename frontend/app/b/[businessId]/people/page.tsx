import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import ModuleRenderer from "@/components/workspace/ModuleRenderer";
import ContactsCrmPanel from "@/components/people/ContactsCrmPanel";
import RelationshipFollowUpQueue from "@/components/people/RelationshipFollowUpQueue";
import { platformStore } from "@/lib/server/compose";
import {
  businessHasAiProspecting,
  readPurchasedPackagesFromConfig,
} from "../../../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { businessGrantsSocialCheckerAccess } from "../../../../../backend/core/platform/packages/socialCheckerEntitlement.js";

/**
 * One People surface: CRM roster + relationship follow-ups when available.
 */
export default async function PeoplePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getAuthorizedWorkspace(businessId);
  await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "people" });

  let followUpCandidates: any[] = [];
  try {
    const followUps = (ctx.service as any)?.loadRelationshipFollowUps?.({ includeProductContext: false });
    followUpCandidates = Array.isArray(followUps?.candidates) ? followUps.candidates : [];
  } catch {
    followUpCandidates = [];
  }

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const purchasedPackages = readPurchasedPackagesFromConfig(installation?.configuration ?? {});
  const aiProspectingEnabled = businessHasAiProspecting(purchasedPackages);
  const socialCheckerEnabled = businessGrantsSocialCheckerAccess(purchasedPackages);

  return (
    <ModuleRenderer moduleId="people">
      <div style={{ display: "grid", gap: 24, width: "100%", maxWidth: 1400, margin: "0 auto" }}>
        {followUpCandidates.length > 0 ? (
          <RelationshipFollowUpQueue businessId={businessId} candidates={followUpCandidates} />
        ) : null}
        <ContactsCrmPanel
          businessId={businessId}
          aiProspectingEnabled={aiProspectingEnabled}
          socialCheckerEnabled={socialCheckerEnabled}
        />
      </div>
    </ModuleRenderer>
  );
}
