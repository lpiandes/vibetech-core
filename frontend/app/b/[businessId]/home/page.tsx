import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import BusinessOnboardingHome from "@/components/operating/BusinessOnboardingHome";
import MissionControlRenderer from "@/components/mission-control/MissionControlRenderer";
import { composePortalModel } from "@/lib/portal-renderer/composePortalModel.js";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

/**
 * Home is one experience with two moments:
 * 1) Pre-install → Talk to VIBETech (Customer Promise: tell us → recommend → approve → live)
 * 2) Post-install → editorial operating Home (supervise a living business)
 */
export default async function BusinessHomePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("home", async () => {
    const ctx = await getAuthorizedWorkspace(businessId);

    let hasInstalledOs = false;
    let installedSpecification: Record<string, unknown> | null = null;
    try {
      const installation = await platformStore.getBusinessOSInstallation(businessId);
      let specification = null;
      if (installation?.specificationId) {
        const specRow = await platformStore.getBusinessOSSpecification({
          businessId,
          specificationId: installation.specificationId,
        });
        specification = specRow?.specification ?? null;
        installedSpecification = specification && typeof specification === "object"
          ? (specification as Record<string, unknown>)
          : null;
      }
      if (installation?.configuration || specification) {
        const portalModel = composePortalModel({
          businessId,
          role: String(ctx.role ?? "OWNER"),
          permissions: Array.from((ctx.permissions as Iterable<string> | undefined) ?? []).map(String),
          configuration: installation?.configuration ?? null,
          specification,
        } as any);
        hasInstalledOs = Boolean(portalModel?.drivenByBusinessOS);
      }
    } catch {
      hasInstalledOs = false;
    }

    const knowledgeDocumentCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    markRequestTiming("KNOWLEDGE_DB");
    ctx.service.refreshOperationalState(knowledgeDocumentCount);
    markRequestTiming("REFRESH_OPERATIONAL_STATE");

    const home = ctx.service.loadBusinessHomeViewModel({
      activeKnowledgeDocumentCount: knowledgeDocumentCount,
      teamInviteChecklistComplete: await platformStore.isTeamInviteChecklistComplete(businessId),
      installedSpecification,
    });
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(home).length });

    // Pre-install: conversation with VIBETech only. No dashboard chrome.
    if (!hasInstalledOs) {
      return (
        <BusinessOnboardingHome
          businessId={businessId}
          businessName={home.businessName}
        />
      );
    }

    // Product 2 — installed: editorial operating Home.
    const ownerFirstName = String((ctx.user as { name?: string | null } | undefined)?.name ?? "")
      .trim()
      .split(/\s+/)[0] || null;
    const missionControlViewModel = ctx.service.loadMissionControlViewModel({
      ownerFirstName,
      setupChecklist: Array.isArray(home.checklist) ? home.checklist : [],
    });
    markRequestTiming("MISSION_CONTROL", {
      bytes: JSON.stringify(missionControlViewModel).length,
    });

    return (
      <MissionControlRenderer
        viewModel={missionControlViewModel as never}
        variant="mission_control"
      />
    );
  });
}
