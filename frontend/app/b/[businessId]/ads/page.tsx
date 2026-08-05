import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import AdsMetricsDashboard from "@/components/ads/AdsMetricsDashboard";
import { fetchAdsMetrics } from "../../../../../backend/core/integrations/ads/AdsMetricsAggregator.js";

/**
 * Ads performance surface — normalized spend/impressions/clicks/CTR/leads/CPL
 * across every connected ads provider (Meta / Google / TikTok). Providers
 * without a stored credential show a Connect-in-Integrations empty state
 * instead of fabricated numbers.
 */
export default async function AdsMetricsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("ads-metrics", async () => {
    const ctx = await getAuthorizedBusinessScope(businessId, PERMISSIONS.PERFORMANCE_VIEW);
    const installation = await getCachedBusinessOsInstallation(businessId).catch(() => null);
    await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "ads", installation });
    const initialData = await fetchAdsMetrics({ businessId, platformStore, days: 30 });

    return (
      <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto" }}>
        <AdsMetricsDashboard businessId={businessId} initialData={initialData as any} />
      </div>
    );
  });
}
