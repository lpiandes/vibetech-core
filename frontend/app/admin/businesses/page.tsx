import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing } from "@/design/tokens";
import Link from "next/link";

export default async function AdminBusinessesPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().listBusinesses({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="Businesses" description="Directory of client businesses" />
      <ShellPanel title="Business directory" subtitle="Open summary or start audited support">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Name", "Industry", "Owner", "OS", "Readiness", "Actions"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.businesses ?? []).map((business: any) => (
                <tr key={business.id}>
                  <td style={{ padding: 8 }}>{business.name}</td>
                  <td style={{ padding: 8 }}>{business.industry}</td>
                  <td style={{ padding: 8 }}><StatusBadge label={String(business.ownerStatus)} tone="neutral" /></td>
                  <td style={{ padding: 8 }}>{business.installedOsVersion ?? "—"}</td>
                  <td style={{ padding: 8 }}>{business.readiness}</td>
                  <td style={{ padding: 8, display: "flex", gap: 8 }}>
                    <Link href={`/admin/businesses/${business.id}`}>Summary</Link>
                    <Link href={`/admin/support?businessId=${business.id}`}>Support</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.businesses?.length ? (
            <div style={{ color: cockpitColors.textMuted, padding: spacing.md }}>No businesses yet.</div>
          ) : null}
        </div>
      </ShellPanel>
    </div>
  );
}
