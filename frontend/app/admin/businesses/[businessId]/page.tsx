import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import OpenBusinessAsAdminButton from "@/components/admin/OpenBusinessAsAdminButton";
import AdminOwnerInviteActions from "@/components/admin/AdminOwnerInviteActions";
import SupportEnterForm from "@/components/admin/SupportEnterForm";
import AdminBusinessManagePanel from "@/components/admin/AdminBusinessManagePanel";
import AdminWhiteGloveOpsPanel from "@/components/admin/AdminWhiteGloveOpsPanel";
import { VtCard, VtDockLink, VtPanel } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

/**
 * Admin gate into a client business — primary job is open their real workspace.
 */
export default async function AdminBusinessDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ needSupport?: string }>;
}) {
  const { businessId } = await params;
  const query = searchParams ? await searchParams : {};
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
  const needSupport = String(query.needSupport ?? "") === "1";

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
      {needSupport ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #fcd34d",
            background: "#fffbeb",
            color: "#92400e",
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          Support access is required before opening this workspace. Click Continue to business below.
        </div>
      ) : null}

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
        <AdminOwnerInviteActions
          businessId={business.id}
          ownerStatus={business.ownerStatus ?? null}
        />
      </VtPanel>

      <AdminBusinessManagePanel
        businessId={business.id}
        initialName={business.name}
        status={business.status ?? "ACTIVE"}
        initialPackageConfiguration={business.packageConfiguration ?? null}
      />

      <AdminWhiteGloveOpsPanel businessId={business.id} />

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
