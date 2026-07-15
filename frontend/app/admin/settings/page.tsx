import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing } from "@/design/tokens";

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
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader
        title="Admin settings"
        description="Platform control policies and Ask capability honesty"
      />
      <ShellPanel title="Access policy" subtitle="Non-negotiable rules">
        <ul style={{ color: cockpitColors.textMuted, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
          <li>Only PLATFORM_ADMIN may open /admin routes.</li>
          <li>Support access requires a reason and is fully audited.</li>
          <li>Admins never silently become business owners.</li>
          <li>Support sessions never grant permanent membership.</li>
          <li>Partial install failures remain visible in install history.</li>
          <li>Customer outbound send never happens silently — drafts need approval.</li>
        </ul>
      </ShellPanel>

      <ShellPanel
        title="Ask capability honesty"
        subtitle="What owners can enable today — available / needs setup / not yet"
      >
        {!honesty.ok ? (
          <div style={{ color: cockpitColors.textMuted }}>Unauthorized</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {(honesty.packages ?? []).map((pkg) => (
              <div
                key={pkg.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(140px, 1.2fr) minmax(120px, 0.8fr) 2fr",
                  gap: spacing.sm,
                  padding: `${spacing.sm}px 0`,
                  borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  alignItems: "start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{pkg.label}</div>
                  <div style={{ color: cockpitColors.textMuted, fontSize: 12 }}>{pkg.id}</div>
                </div>
                <div style={{ color: STATUS_COLOR[pkg.status] ?? cockpitColors.textMuted, fontWeight: 600 }}>
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
            ))}
          </div>
        )}
      </ShellPanel>
    </div>
  );
}
