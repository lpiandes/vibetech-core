import type { ReactNode } from "react";
import { BookOpen, Building2, Check, Mail, Users } from "lucide-react";

import ActionRow from "@/components/product/ActionRow";
import { ProductPage, PageHeader, Section } from "@/components/product";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type ChecklistItem = {
  id: string;
  title: string;
  actionLabel: string;
  href: string;
  complete: boolean;
};

const CHECKLIST_META: Record<string, { description: string; icon: ReactNode }> = {
  team: { description: "Invite employees to collaborate in VIBETech", icon: <Users size={18} /> },
  email: { description: "Connect the mailbox used for approved customer email", icon: <Mail size={18} /> },
  software: { description: "Connect systems of record your business already pays for", icon: <Building2 size={18} /> },
  knowledge: { description: "Add policies and documents VIBETech can cite", icon: <BookOpen size={18} /> },
  prospect: { description: "Test intake with a real inquiry — outbound still needs your approval", icon: <Mail size={18} /> },
};

export default function EmptyBusinessHome({
  businessName,
  checklist,
  businessId = null,
}: {
  businessName: string;
  isDemo: boolean;
  checklist: ChecklistItem[];
  businessId?: string | null;
}) {
  const completeCount = checklist.filter((item) => item.complete).length;
  const total = checklist.length;
  const progress = total > 0 ? Math.round((completeCount / total) * 100) : 0;
  const allComplete = completeCount === total && total > 0;
  const incomplete = checklist.filter((item) => !item.complete);

  return (
    <ProductPage>
      <PageHeader
        title={allComplete ? `You're all set, ${businessName}` : `Welcome to ${businessName}`}
        description={
          allComplete
            ? "Your setup checklist is complete. Explore your workspace or invite more team members."
            : "Complete these steps to get your business running on VIBETech — or ask Architect to install your operating system."
        }
      />

      {businessId ? (
        <div style={{ marginBottom: spacing.md }}>
          <ActionRow
            icon={<Building2 size={18} />}
            title="Build with Architect"
            description="Describe your business once. Architect proposes a governed operating system."
            actionLabel="Open Architect"
            href={`/architect?businessId=${encodeURIComponent(businessId)}`}
            isLast
          />
        </div>
      ) : null}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.xs }}>
          <span style={{ ...typography.caption, color: cockpitColors.textMuted }}>Setup progress</span>
          <span style={{ ...typography.caption, fontWeight: 600, color: cockpitColors.textPrimary }}>
            {completeCount} of {total} complete
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: cockpitColors.panelElevated,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              borderRadius: radius.pill,
              backgroundColor: allComplete ? "#16a34a" : cockpitColors.accent,
              transition: "width 0.2s ease",
            }}
          />
        </div>
      </div>

      {allComplete ? (
        <div
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radius.large,
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: typography.caption.fontSize,
            lineHeight: 1.5,
          }}
        >
          All setup steps are complete. Your team can start using VIBETech.
        </div>
      ) : null}

      <Section title={allComplete ? "Completed setup" : "Get started"}>
        {checklist.map((item, index) => {
          const meta = CHECKLIST_META[item.id] ?? { description: undefined, icon: <Check size={18} /> };
          return (
            <ActionRow
              key={item.id}
              icon={item.complete ? <Check size={18} strokeWidth={3} /> : meta.icon}
              title={item.title}
              description={item.complete ? "Complete" : meta.description}
              status={item.complete ? "Done" : undefined}
              statusTone="success"
              actionLabel={item.complete ? undefined : item.actionLabel}
              href={item.complete ? undefined : item.href}
              complete={item.complete}
              isLast={index === checklist.length - 1}
            />
          );
        })}
      </Section>

      {!allComplete && incomplete.length > 0 ? (
        <p style={{ ...typography.caption, color: cockpitColors.textMuted, margin: 0, lineHeight: 1.5 }}>
          Next up: <strong style={{ color: cockpitColors.textPrimary }}>{incomplete[0].title}</strong>
        </p>
      ) : null}
    </ProductPage>
  );
}
