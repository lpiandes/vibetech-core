import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { platformStore } from "@/lib/server/compose";
import OutcomesLedgerExperience from "@/components/outcomes/OutcomesLedgerExperience";
import { composeOutcomesLedger } from "../../../../../backend/core/operating-home/composeOutcomesLedger.js";

export default async function OutcomesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return runTimedPage("outcomes", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const mission = service.loadMissionControlViewModel({});
    const recentOutcomes =
      (mission as any)?.experience?.supervision?.recentOutcomes
      ?? (mission as any)?.supervision?.recentOutcomes
      ?? [];
    const view = composeOutcomesLedger({
      installation,
      recentOutcomes,
      businessId,
    });
    return <OutcomesLedgerExperience view={view as never} />;
  });
}
