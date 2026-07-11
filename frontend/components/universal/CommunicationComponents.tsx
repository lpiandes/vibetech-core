"use client";

import { UcBadge, UcHost, UcRow, type UniversalChromeProps } from "./chrome";

type Item = Record<string, any>;
function itemsOf(props: { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

export function CommunicationCenter(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="communication_center" empty={!items.length} emptyTitle="No conversations" emptyDescription="Inbound and outbound threads will appear here.">
      {items.slice(0, 8).map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.subject ?? item.title ?? "Thread")}
          detail={String(item.preview ?? item.summary ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
          meta={<UcBadge dark={props.dark}>{String(item.channel ?? "Message")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function Inbox(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="inbox" empty={!items.length} emptyTitle="Inbox zero" emptyDescription="New messages will land here for triage.">
      {items.slice(0, 10).map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.subject ?? item.title ?? "Message")}
          detail={String(item.fromLabel ?? item.preview ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
          meta={item.unread ? <UcBadge tone="accent" dark={props.dark}>New</UcBadge> : null}
        />
      ))}
    </UcHost>
  );
}

export function Notifications(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="notifications" empty={!items.length} emptyTitle="No notifications" emptyDescription="System notifications will appear here.">
      {items.slice(0, 8).map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.title ?? "Notification")}
          detail={String(item.summary ?? "")}
          dark={props.dark}
        />
      ))}
    </UcHost>
  );
}

export function Alerts(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="alerts" empty={!items.length} emptyTitle="No alerts" emptyDescription="Operational alerts will appear when attention is needed.">
      {items.slice(0, 8).map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.title ?? "Alert")}
          detail={String(item.summary ?? item.reason ?? "")}
          dark={props.dark}
          meta={<UcBadge tone="warning" dark={props.dark}>{String(item.severity ?? "alert")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}
