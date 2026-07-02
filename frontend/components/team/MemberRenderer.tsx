"use client";

import { useContext } from "react";
import { TeamViewModelContext } from "./TeamContext";

function badgeClasses(badge: string) {
  // Presentation-only badge colors. No business semantics beyond a best-effort mapping.
  const b = String(badge ?? "").toLowerCase();
  if (b.includes("blocked")) return "bg-red-50 text-red-700 border-red-200";
  if (b.includes("offline")) return "bg-zinc-50 text-zinc-700 border-zinc-200";
  if (b.includes("overloaded")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (b.includes("away")) return "bg-slate-50 text-slate-700 border-slate-200";
  if (b.includes("busy")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
}

export default function MemberRenderer() {
  const viewModel = useContext<any | null>(TeamViewModelContext);
  if (!viewModel) return null;

  const members = Array.isArray(viewModel.members) ? viewModel.members : [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Members</div>
          <div className="mt-1 text-xs text-muted-foreground">Who is working and what they need</div>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No team members have been added yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {members.map((m: any) => {
            const status = String(m.status ?? "");
            const attention = Boolean(m.attentionRequired);
            return (
              <div
                key={String(m.id)}
                className={["rounded-xl border border-border bg-card p-4 shadow-sm", attention ? "ring-1 ring-red-200" : ""].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{String(m.name ?? "")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {String(m.department?.name ?? "")} · {String(m.role?.name ?? "")}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">{status}</div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.isArray(m.badges) && m.badges.length > 0
                    ? m.badges.map((b: any) => (
                        <span key={String(b)} className={["inline-flex items-center rounded-full border px-2 py-1 text-xs", badgeClasses(b)].join(" ")}>
                          {String(b)}
                        </span>
                      ))
                    : null}
                  {attention ? (
                    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">Attention required</span>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>Assigned: {String(m.workload?.assignedWork ?? 0)}</div>
                  <div>Pending: {String(m.workload?.pendingWork ?? 0)}</div>
                  <div>Done: {String(m.workload?.completedWork ?? 0)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

