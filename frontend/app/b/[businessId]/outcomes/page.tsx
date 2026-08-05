import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import OutcomesLedgerExperience from "@/components/outcomes/OutcomesLedgerExperience";
import { composeOutcomesLedger } from "../../../../../backend/core/operating-home/composeOutcomesLedger.js";

export default async function OutcomesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return runTimedPage("outcomes", async () => {
    // Scope-only — do not boot full workspace / Mission Control just for the ledger.
    await getAuthorizedBusinessScope(businessId);
    const installation = await getCachedBusinessOsInstallation(businessId).catch(() => null);
    const view = composeOutcomesLedger({
      installation,
      recentOutcomes: [],
      businessId,
    });
    return <OutcomesLedgerExperience view={view as never} />;
  });
}
