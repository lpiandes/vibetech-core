import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing } from "@/design/tokens";
import Link from "next/link";
import SupportEnterForm from "@/components/admin/SupportEnterForm";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title={business.name} description="Business summary · never silent ownership" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: spacing.md }}>
        <ShellPanel title="Overview" subtitle="Installation and readiness">
          <div style={{ color: cockpitColors.textMuted, lineHeight: 1.6 }}>
            <div>Industry: {business.industry ?? "—"}</div>
            <div>Owner: {business.ownerStatus}</div>
            <div>Install: {business.installation?.status ?? "not installed"}</div>
            <div>Spec: {business.installation?.specificationVersion ?? "—"}</div>
            <p style={{ marginTop: spacing.md }}>{business.note}</p>
          </div>
          <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
            <Link href={`/architect?businessId=${business.id}`}>Open Architect</Link>
            <Link href={`/admin/installations`}>Install history</Link>
          </div>
        </ShellPanel>

        <ShellPanel title="Members" subtitle="Tenant memberships">
          {business.members.length ? business.members.map((member: any) => (
            <div key={member.userId} style={{ padding: `${spacing.xs}px 0` }}>
              {member.name ?? member.email} · {member.role}
            </div>
          )) : <div style={{ color: cockpitColors.textMuted }}>No members.</div>}
        </ShellPanel>

        <ShellPanel title="Audited support access" subtitle="Reason required">
          <SupportEnterForm businessId={business.id} businessName={business.name} />
          {business.supportSession ? (
            <div style={{ marginTop: spacing.md, color: cockpitColors.textMuted }}>
              Active support session: {business.supportSession.mode} · {business.supportSession.reason}
            </div>
          ) : null}
        </ShellPanel>
      </div>
    </div>
  );
}
