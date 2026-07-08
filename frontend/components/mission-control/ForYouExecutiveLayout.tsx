"use client";

import { useContext } from "react";
import { AlertCircle, Mail } from "lucide-react";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { ProductPage, PageHeader, Section, ActionRow, EmptyState } from "@/components/product";

function safeArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

function attentionIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("email") || t.includes("connect")) return <Mail size={18} />;
  return <AlertCircle size={18} />;
}

function attentionDescription(item: any) {
  const title = String(item.title ?? "").toLowerCase();
  if (title.includes("business email") || title.includes("email")) {
    return "Email must be connected before VIBETech can send or receive messages.";
  }
  const summary = String(item.summary ?? "").trim();
  const reason = String(item.reason ?? "").trim();
  if (summary && !summary.includes("Owner response") && !summary.includes("Production provider")) {
    return summary.slice(0, 140);
  }
  if (reason && reason !== "Real business provider is not yet connected.") return reason.slice(0, 140);
  return "This needs your decision before work can continue.";
}

function attentionAction(item: any, businessId: string) {
  const actions = safeArray(item.availableActions);
  const first = actions[0];
  if (first?.href && first?.label) {
    return { label: String(first.label), href: String(first.href) };
  }
  if (String(item.sourceType) === "connection") {
    return { label: "Connect", href: `/b/${businessId}/integrations` };
  }
  return { label: "Review", href: "/mission-control" };
}

export default function ForYouExecutiveLayout() {
  const viewModel = useContext<MissionControlViewModel | null>(MissionControlViewModelContext);
  const { businessId } = useBusinessScope();
  if (!viewModel) return null;

  const cc = (viewModel as any).commandCenter ?? viewModel;
  const attention = safeArray(cc.needsYourAttention);

  return (
    <ProductPage>
      <PageHeader title="For you" />

      {attention.length === 0 ? (
        <EmptyState title="You're all caught up" description="Nothing needs your attention right now." />
      ) : (
        <Section title={attention.length === 1 ? "Needs your attention" : `Needs your attention (${attention.length})`}>
          {attention.map((item: any, index: number) => {
            const action = attentionAction(item, businessId);
            const title = String(item.title ?? "Attention item");
            const friendlyTitle = title.replace(/ for production$/i, "").replace(/^Connect /i, (m) => m);
            const displayTitle =
              friendlyTitle.toLowerCase().includes("business email") || title.toLowerCase().includes("business email")
                ? "Connect business email"
                : friendlyTitle;

            return (
              <ActionRow
                key={String(item.id)}
                icon={attentionIcon(displayTitle)}
                title={displayTitle}
                description={attentionDescription(item)}
                actionLabel={action.label === "Open connections" ? "Connect email" : action.label}
                href={action.href}
                isLast={index === attention.length - 1}
              />
            );
          })}
        </Section>
      )}
    </ProductPage>
  );
}
