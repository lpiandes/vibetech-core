import { readPurchasedPackagesFromConfig } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { businessGrantsFeRetentionAccess } from "../../../backend/core/fe-retention/feRetentionEntitlement.js";
import { ensureFeRetentionInstallation } from "../../../backend/core/fe-retention/ensureFeRetentionInstallation.js";
import { insuranceDashboardPath } from "@/lib/platform/hosts";
import { putDurableCredential } from "../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";

/**
 * Session stages where the owner has moved past discovery — route straight to the
 * install/recovery trail instead of the discovery conversation. "installed" is included
 * because a builder session can claim installed while canonical Business OS persistence
 * never completed (the Approve/Open bug); the install page self-heals that case rather than
 * silently starting a brand new session.
 */
const INSTALL_STAGE_KEYS = new Set([
  "dry_run_ready",
  "awaiting_approval",
  "installing",
  "failed",
  "installed",
]);

/**
 * Post-invite / first-run routing: Architect is primary when the business
 * has no installed Operating System yet.
 * FE Retention CRM agents skip Architect and land on the insurance dashboard.
 */
export async function resolvePostInviteRedirect({
  platformStore,
  getAiBuilderService,
  businessId,
  membershipRole,
  actorUserId,
  businessName = null,
}: {
  platformStore: any;
  getAiBuilderService: () => any;
  businessId: string;
  membershipRole: string | null | undefined;
  actorUserId: string;
  businessName?: string | null;
}): Promise<{ redirectTo: string; architectSessionId?: string }> {
  const home = `/b/${businessId}/home`;

  try {
    const business = await platformStore.getBusinessById?.(businessId);
    const packages = readPurchasedPackagesFromConfig(business?.packageConfiguration ?? {});
    if (businessGrantsFeRetentionAccess(packages)) {
      await ensureFeRetentionInstallation({
        platformStore,
        businessId,
        packageConfiguration: business?.packageConfiguration ?? null,
        actorId: actorUserId,
        putDurableCredential,
        vault: getSharedCredentialVault(),
      });
      return { redirectTo: insuranceDashboardPath(businessId) };
    }
  } catch (err) {
    console.error("[post-invite] fe retention check failed", err);
  }

  const role = String(membershipRole ?? "").toUpperCase();
  if (role !== "OWNER") {
    return { redirectTo: home };
  }

  let installation = null;
  try {
    installation = await platformStore.getBusinessOSInstallation?.(businessId);
  } catch {
    installation = null;
  }
  if (installation?.status === "installed") {
    return { redirectTo: home };
  }

  try {
    const builder = getAiBuilderService();
    const existing = await builder.listSessions?.({ businessId });
    const cards = existing?.sessions ?? [];
    const resumable = cards.find((row: any) => {
      const stage = String(row.stageKey ?? "");
      return Boolean(stage) && stage !== "archived" && Boolean(row.sessionId);
    });
    if (resumable?.sessionId) {
      const sessionId = String(resumable.sessionId);
      const stage = String(resumable.stageKey ?? "");
      const redirectTo = INSTALL_STAGE_KEYS.has(stage)
        ? `/architect/${sessionId}/install`
        : `/architect/${sessionId}`;
      return { redirectTo, architectSessionId: sessionId };
    }

    const started = await builder.startSession({
      mode: "configure_existing_business",
      businessId,
      businessName: businessName ?? undefined,
      actorId: actorUserId,
    });
    const sessionId = started.session?.sessionId;
    if (sessionId) {
      return { redirectTo: `/architect/${sessionId}`, architectSessionId: sessionId };
    }
  } catch (err) {
    console.error("[post-invite] architect bootstrap failed", err);
  }

  return { redirectTo: `/architect?businessId=${encodeURIComponent(businessId)}` };
}
