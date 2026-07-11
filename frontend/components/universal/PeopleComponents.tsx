"use client";

import { UcBadge, UcGrid, UcHost, UcRow, type UniversalChromeProps } from "./chrome";
import { cockpitColors, spacing, radius } from "@/design/tokens";

type Item = Record<string, any>;
function itemsOf(props: { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

export function EmployeeCards(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="employee_cards" empty={!items.length} emptyTitle="No employees" emptyDescription="Invite teammates or install digital employees.">
      <UcGrid min={200}>
        {items.map((item) => (
          <div key={String(item.id ?? item.name)} style={card(props.dark)}>
            <div style={{ fontWeight: 700 }}>{String(item.name ?? item.label ?? "Employee")}</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{String(item.roleLabel ?? item.purpose ?? "")}</div>
            <div style={{ marginTop: 10 }}>
              <UcBadge tone={item.status === "ready" ? "success" : "neutral"} dark={props.dark}>
                {String(item.statusLabel ?? item.status ?? "Active")}
              </UcBadge>
            </div>
          </div>
        ))}
      </UcGrid>
    </UcHost>
  );
}

export function TeamDirectory(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="team_directory" empty={!items.length} emptyTitle="No team members" emptyDescription="Invite people to populate the directory.">
      {items.map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.name ?? item.label ?? "Member")}
          detail={String(item.roleLabel ?? item.email ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
          meta={<UcBadge dark={props.dark}>{String(item.kind ?? "Human")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function OrganizationChart(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="organization_chart" empty={!items.length} emptyTitle="No org structure" emptyDescription="Add roles and reporting lines to visualize the organization.">
      <div style={{ display: "grid", gap: spacing.sm }}>
        {items.map((item) => (
          <div key={String(item.id)} style={{ ...card(props.dark), marginLeft: Number(item.depth ?? 0) * 16 }}>
            <div style={{ fontWeight: 650 }}>{String(item.name ?? item.label)}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{String(item.roleLabel ?? item.reportsToLabel ?? "")}</div>
          </div>
        ))}
      </div>
    </UcHost>
  );
}

export function CustomerList(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost
      {...props}
      componentType="customer_list"
      empty={!items.length}
      emptyTitle="No customers yet"
      emptyDescription="Import or add customers to begin relationship work."
      terminologyKey="customer"
    >
      {items.map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.name ?? item.displayName ?? item.label ?? "Customer")}
          detail={String(item.email ?? item.summary ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
          meta={<UcBadge dark={props.dark}>{String(item.relationshipLabel ?? "Customer")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

function card(dark?: boolean) {
  return {
    borderRadius: radius.large,
    border: `1px solid ${dark ? "rgba(148,163,184,.14)" : cockpitColors.panelBorder}`,
    background: dark ? "rgba(15,23,42,.55)" : cockpitColors.panelElevated,
    padding: spacing.md,
  } as const;
}
