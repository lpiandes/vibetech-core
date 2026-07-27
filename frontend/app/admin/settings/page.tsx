import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import { VtCard, VtDockLink, VtPanel } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

const STATUS_COLOR: Record<string, string> = {
  available: cockpitColors.handled,
  needs_setup: cockpitColors.warning,
  not_yet: cockpitColors.textMuted,
};

export default async function AdminSettingsPage() {
  const user = await requirePlatformAdmin();
  const honesty = getAdminPlatformService().getCapabilityHonesty({
    platformRole: user.platformRole,
  });

  return (
    <AdminVtPage
      title="Admin settings"
      dock={<VtDockLink href="/admin">Dashboard</VtDockLink>}
    >
      <VtPanel title="Access policy">
        <ul style={{ color: cockpitColors.textMuted, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
          <li>Only PLATFORM_ADMIN may open /admin routes.</li>
          <li>Support access requires a reason and is fully audited.</li>
          <li>Admins never silently become business owners.</li>
          <li>Support sessions never grant permanent membership.</li>
          <li>Partial install failures remain visible in install history.</li>
          <li>Customer outbound send never happens silently — drafts need approval.</li>
        </ul>
      </VtPanel>

      <VtPanel title="Ask capability honesty">
        {!honesty.ok ? (
          <div style={{ color: cockpitColors.textMuted }}>Unauthorized</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {(honesty.packages ?? []).map((pkg: {
              id: string;
              label: string;
              status: string;
              statusLabel: string;
              ownerPromise: string;
              setupRequirements?: string[];
            }) => (
              <VtCard key={pkg.id} padding={14}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(140px, 1.2fr) minmax(120px, 0.8fr) 2fr",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{pkg.label}</div>
                    <div style={{ color: cockpitColors.textMuted, fontSize: 12 }}>{pkg.id}</div>
                  </div>
                  <div style={{ color: STATUS_COLOR[pkg.status] ?? cockpitColors.textMuted, fontWeight: 700 }}>
                    {pkg.statusLabel}
                  </div>
                  <div style={{ color: cockpitColors.textMuted, fontSize: 13, lineHeight: 1.5 }}>
                    {pkg.ownerPromise}
                    {pkg.setupRequirements?.length ? (
                      <div style={{ marginTop: 4 }}>
                        Setup: {pkg.setupRequirements.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              </VtCard>
            ))}
          </div>
        )}
      </VtPanel>
    </AdminVtPage>
  );
}
