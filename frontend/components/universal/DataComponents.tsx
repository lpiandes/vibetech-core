"use client";

import { UcBadge, UcHost, UcRow, type UniversalChromeProps } from "./chrome";
import { cockpitColors, spacing } from "@/design/tokens";

type Item = Record<string, any>;
function itemsOf(props: { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

export function Tables(props: UniversalChromeProps & { items?: Item[]; columns?: Array<{ id: string; label: string }> }) {
  const items = itemsOf(props);
  const columns = props.columns?.length
    ? props.columns
    : Object.keys(items[0] ?? { name: "", status: "" })
        .filter((key) => key !== "id" && key !== "href")
        .slice(0, 4)
        .map((id) => ({ id, label: id.replace(/_/g, " ") }));

  return (
    <UcHost {...props} componentType="tables" empty={!items.length} emptyTitle="No rows" emptyDescription="Tabular data will appear here.">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} style={thStyle(props.dark)}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 20).map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column) => (
                  <td key={column.id} style={tdStyle(props.dark)}>{String(row[column.id] ?? "—")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UcHost>
  );
}

export function DataGrid(props: UniversalChromeProps & { items?: Item[]; columns?: Array<{ id: string; label: string }> }) {
  const items = itemsOf(props);
  const columns = props.columns?.length
    ? props.columns
    : [
        { id: "label", label: "Name" },
        { id: "status", label: "Status" },
        { id: "owner", label: "Owner" },
      ];
  return (
    <UcHost {...props} componentType="data_grid" empty={!items.length} emptyTitle="No records" emptyDescription="Records will appear in this grid.">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>{columns.map((column) => <th key={column.id} style={thStyle(props.dark)}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {items.slice(0, 25).map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column) => (
                  <td key={column.id} style={tdStyle(props.dark)}>{String(row[column.id] ?? row.label ?? "—")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UcHost>
  );
}

export function SearchResults(props: UniversalChromeProps & { items?: Item[]; query?: string }) {
  const items = itemsOf(props);
  return (
    <UcHost
      {...props}
      componentType="search_results"
      empty={!items.length}
      emptyTitle={props.query ? `No results for “${props.query}”` : "No results"}
      emptyDescription="Try a different search."
    >
      {items.map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.label ?? item.title ?? "Result")}
          detail={String(item.sublabel ?? item.summary ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
          meta={<UcBadge dark={props.dark}>{String(item.kind ?? "Result")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function Filters(props: UniversalChromeProps & { items?: Item[]; activeId?: string | null; onSelect?: (id: string) => void }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="filters" empty={!items.length} emptyTitle="No filters" emptyDescription="Filters appear when a module defines them.">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="list">
        {items.map((item) => {
          const active = String(item.id) === String(props.activeId);
          return (
            <button
              key={String(item.id)}
              type="button"
              role="listitem"
              onClick={() => props.onSelect?.(String(item.id))}
              style={{
                borderRadius: 999,
                border: `1px solid ${props.dark ? "rgba(148,163,184,.2)" : cockpitColors.panelBorder}`,
                background: active ? (props.dark ? "#14B8A6" : cockpitColors.accent) : "transparent",
                color: active ? (props.dark ? "#042F2E" : "#fff") : (props.dark ? "#E2E8F0" : cockpitColors.textPrimary),
                padding: `${spacing.xs} ${spacing.md}`,
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              {String(item.label ?? item.id)}
            </button>
          );
        })}
      </div>
    </UcHost>
  );
}

function thStyle(dark?: boolean) {
  return {
    textAlign: "left" as const,
    padding: `${spacing.sm} ${spacing.sm}`,
    borderBottom: `1px solid ${dark ? "rgba(148,163,184,.2)" : cockpitColors.panelBorder}`,
    color: dark ? "rgba(226,232,240,.7)" : cockpitColors.textMuted,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  };
}

function tdStyle(dark?: boolean) {
  return {
    padding: `${spacing.sm} ${spacing.sm}`,
    borderBottom: `1px solid ${dark ? "rgba(148,163,184,.1)" : cockpitColors.panelBorder}`,
    color: dark ? "#F8FAFC" : cockpitColors.textPrimary,
  };
}
