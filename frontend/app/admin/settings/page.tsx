import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing } from "@/design/tokens";

export default async function AdminSettingsPage() {
  await requirePlatformAdmin();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="Admin settings" description="Platform control policies" />
      <ShellPanel title="Access policy" subtitle="Non-negotiable rules">
        <ul style={{ color: cockpitColors.textMuted, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
          <li>Only PLATFORM_ADMIN may open /admin routes.</li>
          <li>Support access requires a reason and is fully audited.</li>
          <li>Admins never silently become business owners.</li>
          <li>Support sessions never grant permanent membership.</li>
          <li>Partial install failures remain visible in install history.</li>
        </ul>
      </ShellPanel>
    </div>
  );
}
