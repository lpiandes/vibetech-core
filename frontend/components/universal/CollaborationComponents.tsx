"use client";

import { UcBadge, UcHost, UcRow, type UniversalChromeProps } from "./chrome";

type Item = Record<string, any>;
function itemsOf(props: { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

export function Notes(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="notes" empty={!items.length} emptyTitle="No notes" emptyDescription="Notes attached to this record will appear here.">
      {items.map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.title ?? "Note")}
          detail={String(item.body ?? item.summary ?? "")}
          dark={props.dark}
          meta={<span style={{ fontSize: 12, opacity: 0.7 }}>{String(item.authorLabel ?? item.whenLabel ?? "")}</span>}
        />
      ))}
    </UcHost>
  );
}

export function Comments(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="comments" empty={!items.length} emptyTitle="No comments" emptyDescription="Start a discussion on this record.">
      {items.map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.authorLabel ?? "Comment")}
          detail={String(item.body ?? item.text ?? "")}
          dark={props.dark}
          meta={<span style={{ fontSize: 12, opacity: 0.7 }}>{String(item.whenLabel ?? "")}</span>}
        />
      ))}
    </UcHost>
  );
}

export function AuditHistory(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="audit_history" empty={!items.length} emptyTitle="No history" emptyDescription="Audit events will appear as changes are made.">
      {items.map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.actionLabel ?? item.title ?? "Change")}
          detail={String(item.summary ?? item.actorLabel ?? "")}
          dark={props.dark}
          meta={<UcBadge dark={props.dark}>{String(item.whenLabel ?? "Logged")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}
