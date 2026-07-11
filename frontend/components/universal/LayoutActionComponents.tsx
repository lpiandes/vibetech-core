"use client";

import type { ReactNode } from "react";
import { UcBadge, UcGrid, UcHost, UcPanel, UcState, type UniversalChromeProps } from "./chrome";
import { cockpitColors, spacing, radius } from "@/design/tokens";

type Item = Record<string, any>;
function itemsOf(props: { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

export function QuickActions(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="quick_actions" empty={!items.length} emptyTitle="No actions" emptyDescription="Quick actions appear from the installed Business OS.">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map((item) => (
          <a
            key={String(item.id ?? item.href ?? item.label)}
            href={item.href ? String(item.href) : undefined}
            style={{
              borderRadius: 999,
              padding: `${spacing.sm} ${spacing.md}`,
              background: props.dark ? "#14B8A6" : cockpitColors.accent,
              color: props.dark ? "#042F2E" : "#fff",
              fontWeight: 650,
              textDecoration: "none",
            }}
          >
            {String(item.label ?? item.title ?? "Action")}
          </a>
        ))}
      </div>
    </UcHost>
  );
}

export function DashboardSections(props: UniversalChromeProps & { items?: Item[]; children?: ReactNode }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="dashboard_sections" empty={!items.length && !props.children} emptyTitle="No sections" emptyDescription="Dashboard sections are composed from the Business OS.">
      {props.children}
      <UcGrid min={240}>
        {items.map((item) => (
          <UcPanel key={String(item.id ?? item.title)} title={String(item.title ?? item.label)} dark={props.dark} compact>
            <div style={{ opacity: 0.75, lineHeight: 1.45 }}>{String(item.summary ?? item.description ?? "")}</div>
          </UcPanel>
        ))}
      </UcGrid>
    </UcHost>
  );
}

export function EmptyStates(props: UniversalChromeProps & { items?: Item[] }) {
  const item = itemsOf(props)[0];
  return (
    <UcHost {...props} componentType="empty_states" empty={false}>
      <UcState
        kind="empty"
        title={String(item?.title ?? props.emptyTitle ?? "Nothing here yet")}
        description={String(item?.description ?? props.emptyDescription ?? "Add the first item to get started.")}
        dark={props.dark}
      />
    </UcHost>
  );
}

export function SetupWizards(props: UniversalChromeProps & { items?: Item[]; activeStep?: number }) {
  const items = itemsOf(props);
  const active = Number(props.activeStep ?? 0);
  return (
    <UcHost {...props} componentType="setup_wizards" empty={!items.length} emptyTitle="No setup steps" emptyDescription="Setup guidance appears when configuration is required.">
      <div style={{ display: "grid", gap: spacing.sm }}>
        {items.map((item, index) => (
          <div key={String(item.id ?? index)} style={{
            borderRadius: radius.large,
            border: `1px solid ${props.dark ? "rgba(148,163,184,.14)" : cockpitColors.panelBorder}`,
            padding: spacing.md,
            opacity: index > active ? 0.55 : 1,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong>{String(item.title ?? item.label ?? `Step ${index + 1}`)}</strong>
              <UcBadge tone={index < active ? "success" : index === active ? "accent" : "neutral"} dark={props.dark}>
                {index < active ? "Done" : index === active ? "Current" : "Next"}
              </UcBadge>
            </div>
            <div style={{ marginTop: 6, opacity: 0.75 }}>{String(item.description ?? "")}</div>
          </div>
        ))}
      </div>
    </UcHost>
  );
}

export function StatusBadges(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="status_badges" empty={!items.length} emptyTitle="No statuses" emptyDescription="Status badges appear for record states.">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map((item) => (
          <UcBadge key={String(item.id ?? item.label)} tone={item.tone ?? "neutral"} dark={props.dark}>
            {String(item.label ?? item.status ?? "Status")}
          </UcBadge>
        ))}
      </div>
    </UcHost>
  );
}

export function Tags(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="tags" empty={!items.length} emptyTitle="No tags" emptyDescription="Tags help organize records across the business.">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map((item) => (
          <UcBadge key={String(item.id ?? item.label)} tone="accent" dark={props.dark}>
            {String(item.label ?? item.name ?? "Tag")}
          </UcBadge>
        ))}
      </div>
    </UcHost>
  );
}
