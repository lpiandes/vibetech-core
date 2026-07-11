"use client";

import { UcBadge, UcGrid, UcHost, UcRow, type UniversalChromeProps } from "./chrome";
import { cockpitColors, spacing, radius } from "@/design/tokens";

type Item = Record<string, any>;
function itemsOf(props: { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

export function WorkQueue(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="work_queue" empty={!items.length} emptyTitle="No open work" emptyDescription="New work items will appear here for review and action.">
      {items.slice(0, 8).map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.title ?? item.label ?? "Work item")}
          detail={String(item.statusLabel ?? item.ownerLabel ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
          meta={<UcBadge tone={item.priority === "high" || item.priority === "critical" ? "warning" : "neutral"} dark={props.dark}>{String(item.priority ?? "open")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function ApprovalQueue(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="approval_queue" empty={!items.length} emptyTitle="Nothing needs approval" emptyDescription="Approvals requiring your judgment will appear here.">
      {items.slice(0, 8).map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.title ?? "Approval")}
          detail={String(item.summary ?? item.reason ?? "")}
          dark={props.dark}
          meta={<UcBadge tone="warning" dark={props.dark}>Needs you</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function KanbanBoard(props: UniversalChromeProps & { items?: Item[]; columns?: Item[] }) {
  const columns = Array.isArray(props.columns) && props.columns.length
    ? props.columns
    : [
        { id: "todo", label: "To do" },
        { id: "doing", label: "In progress" },
        { id: "done", label: "Done" },
      ];
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="kanban_board" empty={!items.length} emptyTitle="Board is empty" emptyDescription="Move work across stages as it progresses.">
      <UcGrid min={200}>
        {columns.map((column) => {
          const columnItems = items.filter((item) => String(item.columnId ?? item.status ?? "") === String(column.id));
          return (
            <div key={String(column.id)} style={columnStyle(props.dark)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: spacing.sm }}>
                <strong>{String(column.label)}</strong>
                <UcBadge dark={props.dark}>{columnItems.length}</UcBadge>
              </div>
              {columnItems.map((item) => (
                <div key={String(item.id)} style={cardStyle(props.dark)}>
                  <div style={{ fontWeight: 600 }}>{String(item.title ?? item.label)}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{String(item.detail ?? "")}</div>
                </div>
              ))}
            </div>
          );
        })}
      </UcGrid>
    </UcHost>
  );
}

export function TaskList(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="task_list" empty={!items.length} emptyTitle="No tasks" emptyDescription="Tasks will appear here when assigned.">
      {items.map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.title ?? item.label ?? "Task")}
          detail={String(item.dueLabel ?? item.ownerLabel ?? "")}
          dark={props.dark}
          meta={<UcBadge tone={item.done ? "success" : "neutral"} dark={props.dark}>{item.done ? "Done" : "Open"}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

function columnStyle(dark?: boolean) {
  return {
    borderRadius: radius.large,
    border: `1px solid ${dark ? "rgba(148,163,184,.14)" : cockpitColors.panelBorder}`,
    background: dark ? "rgba(2,6,23,.35)" : "#F8FAFC",
    padding: spacing.md,
    minHeight: 180,
  } as const;
}

function cardStyle(dark?: boolean) {
  return {
    borderRadius: radius.medium,
    border: `1px solid ${dark ? "rgba(148,163,184,.14)" : cockpitColors.panelBorder}`,
    background: dark ? "rgba(15,23,42,.8)" : "#fff",
    padding: spacing.sm,
    marginBottom: spacing.sm,
  } as const;
}
