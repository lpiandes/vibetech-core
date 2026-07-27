import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import OpenBusinessAsAdminButton from "@/components/admin/OpenBusinessAsAdminButton";
import SupportEnterForm from "@/components/admin/SupportEnterForm";
import AdminBusinessManagePanel from "@/components/admin/AdminBusinessManagePanel";
import { VtCard, VtDockLink, VtPanel } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

/**
 * Admin gate into a client business — primary job is open their real workspace.
 */
export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().getBusinessSummary({
    adminUserId: user.id,
    platformRole: user.platformRole,
    businessId,
  });

  if (!result.ok || !result.business) {
    return <div>Business not found</div>;
  }

  const business = result.business;
  const supportActive = Boolean(business.supportSession?.active ?? business.supportSession);

  return (
    <AdminVtPage
      title={business.name}
      eyebrow="Admin · Business"
      statusLabel={supportActive ? "Support open" : "Ready"}
      statusTone={supportActive ? "warn" : "live"}
      dock={(
        <>
          <VtDockLink href="/admin/businesses">All businesses</VtDockLink>
          <VtDockLink href={`/admin/support?businessId=${encodeURIComponent(business.id)}`}>Support</VtDockLink>
        </>
      )}
    >
      <VtPanel title="Open their workspace">
        <OpenBusinessAsAdminButton
          businessId={business.id}
          businessName={business.name}
          alreadyActive={supportActive}
        />
        <div style={{ color: cockpitColors.textMuted, fontSize: 14, lineHeight: 1.5, marginTop: 12 }}>
          Owner: {business.ownerStatus ?? "—"} · Install: {business.installation?.status ?? "not installed"}
          {business.members?.length ? ` · ${business.members.length} member${business.members.length === 1 ? "" : "s"}` : ""}
        </div>
      </VtPanel>

      <AdminBusinessManagePanel
        businessId={business.id}
        initialName={business.name}
        status={business.status ?? "ACTIVE"}
        initialPackageConfiguration={business.packageConfiguration ?? null}
      />

      {business.members?.length ? (
        <VtPanel title="Members">
          <div style={{ display: "grid", gap: 8 }}>
            {business.members.map((member: any) => (
              <VtCard key={member.userId} padding={12}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontWeight: 700 }}>{member.name ?? member.email}</span>
                  <span style={{ color: cockpitColors.textMuted }}>{member.role}</span>
                </div>
              </VtCard>
            ))}
          </div>
        </VtPanel>
      ) : null}

      <VtPanel title="Advanced support options">
        <SupportEnterForm businessId={business.id} businessName={business.name} />
      </VtPanel>
    </AdminVtPage>
  );
}
