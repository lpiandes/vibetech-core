import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import { cockpitColors, spacing } from "@/design/tokens";
import OpenBusinessAsAdminButton from "@/components/admin/OpenBusinessAsAdminButton";
import SupportEnterForm from "@/components/admin/SupportEnterForm";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 }}>
      <div>
        <Link href="/admin/businesses" style={{ color: cockpitColors.accent, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ← Businesses
        </Link>
        <PageHeader
          title={business.name}
          description="Open the same Home they use. You’ll see an Admin view banner at the top."
        />
      </div>

      <section
        style={{
          background: cockpitColors.panel,
          border: `1px solid ${cockpitColors.panelBorder}`,
          borderRadius: 18,
          padding: 24,
          display: "grid",
          gap: 16,
        }}
      >
        <OpenBusinessAsAdminButton
          businessId={business.id}
          businessName={business.name}
          alreadyActive={supportActive}
        />
        <div style={{ color: cockpitColors.textMuted, fontSize: 14, lineHeight: 1.5 }}>
          Owner: {business.ownerStatus ?? "—"} · Install: {business.installation?.status ?? "not installed"}
          {business.members?.length ? ` · ${business.members.length} member${business.members.length === 1 ? "" : "s"}` : ""}
        </div>
      </section>

      {business.members?.length ? (
        <section
          style={{
            background: cockpitColors.panel,
            border: `1px solid ${cockpitColors.panelBorder}`,
            borderRadius: 18,
            padding: 20,
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 650 }}>Members</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {business.members.map((member: any) => (
              <div key={member.userId} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>{member.name ?? member.email}</span>
                <span style={{ color: cockpitColors.textMuted }}>{member.role}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <details
        style={{
          background: cockpitColors.panel,
          border: `1px solid ${cockpitColors.panelBorder}`,
          borderRadius: 18,
          padding: 20,
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 650 }}>Advanced support options</summary>
        <div style={{ marginTop: spacing.md }}>
          <SupportEnterForm businessId={business.id} businessName={business.name} />
        </div>
      </details>
    </div>
  );
}
