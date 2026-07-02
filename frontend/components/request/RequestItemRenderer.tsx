"use client";

import type { ReactNode } from "react";

function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
      {text}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export default function RequestItemRenderer({ item }: { item: any }) {
  const badges = Array.isArray(item?.badges) ? item.badges : [];
  const actions = Array.isArray(item?.actions) ? item.actions : [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{String(item?.title ?? "")}</div>
          <div className="mt-1 text-xs text-muted-foreground">{String(item?.requestType ?? "")}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {badges.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-2">
              {badges.slice(0, 3).map((b: string) => (
                <Badge key={String(b)} text={String(b)} />
              ))}
            </div>
          ) : null}
          {item?.attentionRequired ? (
            <div className="rounded-full bg-foreground/5 border border-border px-3 py-1 text-xs font-medium text-foreground">
              Attention required
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 text-sm text-muted-foreground">{String(item?.description ?? "")}</div>

      <Section title="Status">
        {String(item?.status ?? "")}{" "}
        {item?.priority ? <span className="text-xs text-muted-foreground">({String(item?.priority)})</span> : null}
      </Section>

      <Section title="Received / Age">
        <div className="flex flex-col">
          <span>{String(item?.receivedAt ?? "")}</span>
          <span className="text-xs text-muted-foreground">{String(item?.age ?? "")}</span>
        </div>
      </Section>

      <Section title="Due">
        <span>{item?.dueAt ? String(item?.dueAt) : "—"}</span>
      </Section>

      <Section title="Qualification">
        <span>{item?.qualificationStatus ? String(item?.qualificationStatus) : "—"}</span>
      </Section>

      <Section title="Assignment">
        <div className="text-xs text-muted-foreground">
          <div>assignedWorkId: {item?.assignedWorkId ? String(item.assignedWorkId) : "—"}</div>
          <div>assignedTeamMemberId: {item?.assignedTeamMemberId ? String(item.assignedTeamMemberId) : "—"}</div>
        </div>
      </Section>

      {item?.nextAction ? (
        <div className="mt-3 rounded-xl border border-border bg-background px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Next action</div>
          <div className="mt-1 text-sm">{String(item.nextAction)}</div>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Actions</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {actions.map((a: any) => (
              <span key={String(a.id)} className="rounded-full border border-border bg-background px-3 py-1 text-xs">
                {String(a.label ?? a.type ?? a.id)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

