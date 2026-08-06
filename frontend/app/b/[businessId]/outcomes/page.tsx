import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import OutcomesLedgerExperience from "@/components/outcomes/OutcomesLedgerExperience";
import AskVibeTechPrompt from "@/components/operating/AskVibeTechPrompt";
import { composeOutcomesLedger } from "../../../../../backend/core/operating-home/composeOutcomesLedger.js";
import { spacing } from "@/design/tokens";

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
    const winCount = Number(view?.summary?.proofBackedCompleted ?? view?.summary?.completed ?? 0);
    return (
      <div style={{ display: "grid", gap: spacing.lg }}>
        <div style={{ maxWidth: 960, margin: "0 auto", width: "100%", padding: `0 ${spacing.md}` }}>
          <AskVibeTechPrompt
            businessId={businessId}
            showSuggestions
            winCount={winCount}
            placeholder="Ask what changed, what is unproven, or where SLA risk is"
            helperText="Grounded questions only — VIBETech will not invent outcomes."
          />
        </div>
        <OutcomesLedgerExperience view={view as never} />
      </div>
    );
  });
}
