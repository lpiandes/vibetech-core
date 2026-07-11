"use client";

import { UcBadge, UcGrid, UcHost, UcRow, type UniversalChromeProps } from "./chrome";
import { cockpitColors, spacing, radius } from "@/design/tokens";

type Item = Record<string, any>;
function itemsOf(props: { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

export function ActivityFeed(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="activity_feed" empty={!items.length} emptyTitle="No activity" emptyDescription="Activity will show here as the business operates.">
      {items.slice(0, 8).map((item) => (
        <UcRow
          key={String(item.id ?? item.title)}
          title={String(item.title ?? item.label ?? "Activity")}
          detail={String(item.summary ?? item.detail ?? "")}
          dark={props.dark}
          meta={<span style={{ fontSize: 12, opacity: 0.7 }}>{String(item.whenLabel ?? "")}</span>}
        />
      ))}
    </UcHost>
  );
}

export function Timeline(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="timeline" empty={!items.length} emptyTitle="No timeline events" emptyDescription="Timeline events appear as work progresses.">
      <div style={{ display: "grid", gap: spacing.sm }}>
        {items.slice(0, 10).map((item, index) => (
          <div key={String(item.id ?? index)} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: spacing.sm }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: props.dark ? "#14B8A6" : cockpitColors.accent,
                marginTop: 6,
              }} />
              {index < items.length - 1 ? (
                <div style={{ width: 2, flex: 1, background: props.dark ? "rgba(148,163,184,.25)" : cockpitColors.panelBorder, marginTop: 4 }} />
              ) : null}
            </div>
            <UcRow
              title={String(item.title ?? item.label ?? "Event")}
              detail={String(item.summary ?? item.detail ?? "")}
              dark={props.dark}
              meta={<span style={{ fontSize: 12, opacity: 0.7 }}>{String(item.whenLabel ?? "")}</span>}
            />
          </div>
        ))}
      </div>
    </UcHost>
  );
}

export function Calendar(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="calendar" empty={!items.length} emptyTitle="No upcoming events" emptyDescription="Scheduled items will appear here.">
      {items.slice(0, 8).map((item) => (
        <UcRow
          key={String(item.id ?? item.title)}
          title={String(item.title ?? item.label ?? "Event")}
          detail={String(item.whenLabel ?? item.date ?? "")}
          dark={props.dark}
          meta={<UcBadge dark={props.dark}>{String(item.kind ?? "Event")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function SchedulingBoard(props: UniversalChromeProps & { items?: Item[]; columns?: Item[] }) {
  const columns = Array.isArray(props.columns) && props.columns.length
    ? props.columns
    : [
        { id: "morning", label: "Morning" },
        { id: "afternoon", label: "Afternoon" },
        { id: "evening", label: "Evening" },
      ];
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="scheduling_board" empty={!items.length} emptyTitle="Schedule is clear" emptyDescription="Add appointments or jobs to fill the board.">
      <UcGrid min={180}>
        {columns.map((column) => {
          const columnItems = items.filter((item) => String(item.columnId ?? item.slot ?? "") === String(column.id));
          return (
            <div key={String(column.id)} style={boardColumn(props.dark)}>
              <div style={{ fontWeight: 650, marginBottom: spacing.sm }}>{String(column.label)}</div>
              {columnItems.length ? columnItems.map((item) => (
                <div key={String(item.id ?? item.title)} style={boardCard(props.dark)}>
                  <div style={{ fontWeight: 600 }}>{String(item.title ?? item.label)}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{String(item.detail ?? item.whenLabel ?? "")}</div>
                </div>
              )) : (
                <div style={{ fontSize: 13, opacity: 0.6 }}>Open</div>
              )}
            </div>
          );
        })}
      </UcGrid>
    </UcHost>
  );
}

function boardColumn(dark?: boolean) {
  return {
    borderRadius: radius.large,
    border: `1px solid ${dark ? "rgba(148,163,184,.14)" : cockpitColors.panelBorder}`,
    background: dark ? "rgba(2,6,23,.35)" : "#F8FAFC",
    padding: spacing.md,
    minHeight: 160,
  } as const;
}

function boardCard(dark?: boolean) {
  return {
    borderRadius: radius.medium,
    border: `1px solid ${dark ? "rgba(148,163,184,.14)" : cockpitColors.panelBorder}`,
    background: dark ? "rgba(15,23,42,.8)" : "#fff",
    padding: spacing.sm,
    marginBottom: spacing.sm,
  } as const;
}
