"use client";

import { UcBadge, UcHost, UcRow, type UniversalChromeProps } from "./chrome";

type Item = Record<string, any>;
function itemsOf(props: { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

/** Generic subject/asset browser — terminology makes it properties/patients/players. */
function SubjectList(props: UniversalChromeProps & {
  items?: Item[];
  componentType: string;
  emptyTitle: string;
  emptyDescription: string;
  terminologyKey?: string;
}) {
  const items = itemsOf(props);
  return (
    <UcHost
      {...props}
      componentType={props.componentType}
      empty={!items.length}
      emptyTitle={props.emptyTitle}
      emptyDescription={props.emptyDescription}
      terminologyKey={props.terminologyKey}
    >
      {items.map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.displayName ?? item.name ?? item.label ?? "Record")}
          detail={String(item.address ?? item.summary ?? item.subtitle ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
          meta={<UcBadge dark={props.dark}>{String(item.statusLabel ?? item.kind ?? "Active")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function AssetList(props: UniversalChromeProps & { items?: Item[] }) {
  return (
    <SubjectList
      {...props}
      componentType="asset_list"
      emptyTitle="No assets"
      emptyDescription="Add assets to track them here."
      terminologyKey="asset"
    />
  );
}

export function SubjectBrowser(props: UniversalChromeProps & { items?: Item[] }) {
  return (
    <SubjectList
      {...props}
      componentType="subject_browser"
      emptyTitle="No subjects"
      emptyDescription="Subjects appear after import or creation."
      terminologyKey="subject"
    />
  );
}

export function PropertyBrowser(props: UniversalChromeProps & { items?: Item[] }) {
  return (
    <SubjectList
      {...props}
      componentType="property_browser"
      emptyTitle="No properties"
      emptyDescription="Import trusted property listings to get started."
      terminologyKey="property"
    />
  );
}

export function PatientBrowser(props: UniversalChromeProps & { items?: Item[] }) {
  return (
    <SubjectList
      {...props}
      componentType="patient_browser"
      emptyTitle="No patients"
      emptyDescription="Add patients to begin clinical operations."
      terminologyKey="patient"
    />
  );
}

export function PlayerBrowser(props: UniversalChromeProps & { items?: Item[] }) {
  return (
    <SubjectList
      {...props}
      componentType="player_browser"
      emptyTitle="No players"
      emptyDescription="Add players to manage teams and travel."
      terminologyKey="player"
    />
  );
}
