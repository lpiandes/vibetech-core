import { notFound, redirect } from "next/navigation";
import { InsuranceShell } from "@/components/insurance/InsuranceShell";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import { platformStore } from "@/lib/server/compose";
import { businessGrantsFeRetentionAccess } from "../../../../backend/core/fe-retention/feRetentionEntitlement.js";
import { readFeRetentionBilling } from "../../../../backend/core/fe-retention/FeRetentionBilling.js";
import { resolveFeRetentionContinuePath } from "../../../../backend/core/fe-retention/FeRetentionOnboarding.js";
import { ensureFeRetentionInstallation } from "../../../../backend/core/fe-retention/ensureFeRetentionInstallation.js";
import { readPurchasedPackagesFromConfig } from "../../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { getSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";
import { putDurableCredential } from "../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { insuranceBillingPath } from "@/lib/platform/hosts";

export default async function InsuranceBusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const access = await getFeRetentionAccess();
  if (!access.signedIn) {
    redirect(`/insurance?callbackUrl=${encodeURIComponent(`/insurance/${businessId}`)}`);
  }

  const user = await getSessionUser();
  const membership = user
    ? await platformStore.getMembership(user.id, businessId).catch(() => null)
    : null;
  const business = await platformStore.getBusinessById(businessId).catch(() => null);
  if (!business) notFound();

  const packages = readPurchasedPackagesFromConfig(business.packageConfiguration ?? {});
  const entitled = businessGrantsFeRetentionAccess(packages)
    || access.businesses.some((b) => b.id === businessId);
  if (!entitled && membership?.status !== "ACTIVE" && !access.isPlatformAdmin) {
    notFound();
  }
  if (!businessGrantsFeRetentionAccess(packages) && !access.isPlatformAdmin) {
    redirect(`/b/${businessId}/home`);
  }

  const billing = readFeRetentionBilling(business.packageConfiguration ?? {});
  if (!billing.allowsDashboard) {
    if (!access.isPlatformAdmin) redirect(insuranceBillingPath(businessId));
  }
  const next = resolveFeRetentionContinuePath({
    businessId,
    packageConfiguration: business.packageConfiguration,
  });
  if (next.startsWith("/insurance/setup/")) {
    redirect(next);
  }

  await ensureFeRetentionInstallation({
    platformStore,
    businessId,
    packageConfiguration: business.packageConfiguration,
    actorId: user?.id ?? "fe_layout",
    putDurableCredential,
    vault: getSharedCredentialVault(),
    light: true,
    attachSms: true,
  });

  return (
    <InsuranceShell
      businessId={businessId}
      businessName={String(business.name ?? "My book")}
      agentName={access.displayName}
      viewingAsAdmin={access.isPlatformAdmin}
    >
      {children}
    </InsuranceShell>
  );
}
