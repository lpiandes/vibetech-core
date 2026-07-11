"use client";

import { UcBadge, UcHost, UcRow, type UniversalChromeProps } from "./chrome";

type Item = Record<string, any>;
function itemsOf(props: { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

export function KnowledgeBrowser(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="knowledge_browser" empty={!items.length} emptyTitle="No knowledge yet" emptyDescription="Upload approved documents so the business can use them.">
      {items.map((item) => (
        <UcRow
          key={String(item.id)}
          title={String(item.title ?? item.filename ?? "Document")}
          detail={String(item.category ?? item.summary ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
          meta={<UcBadge dark={props.dark}>{String(item.status ?? "Ready")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function DocumentViewer(props: UniversalChromeProps & { document?: Item | null; items?: Item[] }) {
  const doc = props.document ?? itemsOf(props)[0] ?? null;
  return (
    <UcHost
      {...props}
      componentType="document_viewer"
      empty={!doc}
      emptyTitle="No document selected"
      emptyDescription="Choose a document to preview."
    >
      {doc ? (
        <div>
          <div style={{ fontWeight: 650, marginBottom: 8 }}>{String(doc.title ?? doc.filename ?? "Document")}</div>
          <div style={{ opacity: 0.75, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {String(doc.contentPreview ?? doc.summary ?? "Preview unavailable.")}
          </div>
        </div>
      ) : null}
    </UcHost>
  );
}

export function Attachments(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="attachments" empty={!items.length} emptyTitle="No attachments" emptyDescription="Files attached to this record will appear here.">
      {items.map((item) => (
        <UcRow
          key={String(item.id ?? item.filename)}
          title={String(item.filename ?? item.title ?? "File")}
          detail={String(item.mimeType ?? item.sizeLabel ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
        />
      ))}
    </UcHost>
  );
}
