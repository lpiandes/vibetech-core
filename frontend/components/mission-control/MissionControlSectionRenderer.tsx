"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import { useContext, useState } from "react";
import MissionControlCardRenderer from "./MissionControlCardRenderer";
import MissionControlActionRenderer from "./MissionControlActionRenderer";

function layoutClass(layout: string) {
  switch (layout) {
    case "compact":
      return "grid grid-cols-1 md:grid-cols-2 gap-4";
    case "single":
    case "stack":
    default:
      return "grid grid-cols-1 gap-4";
  }
}

export default function MissionControlSectionRenderer({ sectionId }: { sectionId: string }) {
  const viewModel = useContext<MissionControlViewModel | null>(MissionControlViewModelContext);
  if (!viewModel) return null;

  const section = viewModel.sections?.find((s: any) => String(s.id) === String(sectionId)) ?? null;
  if (!section) return null;

  const cards: string[] = Array.isArray(section.cards) ? section.cards.map(String) : [];
  const actions: string[] = Array.isArray(section.actions) ? section.actions.map(String) : [];

  const [expanded, setExpanded] = useState<boolean>(cards.length > 0);

  const emptyCopy = (() => {
    const sid = String(section.id ?? "");
    const title = String(section.title ?? "");

    if (title.toLowerCase().includes("recommendation") || sid.includes("recommendations")) {
      return "Everything looks good. No immediate action is required.";
    }
    if (title.toLowerCase().includes("risk") || sid.includes("risks")) {
      return "No active business risks detected.";
    }
    if (sid.includes("opportunities") || title.toLowerCase().includes("opportunity")) {
      return "No opportunities ready to act on right now.";
    }
    if (sid.includes("decisions") || title.toLowerCase().includes("decision")) {
      return "No decisions are waiting.";
    }
    if (sid.includes("work_queue") || sid.includes("work queue") || title.toLowerCase().includes("work queue")) {
      return "No work requires attention.";
    }
    if (sid.includes("knowledge") || title.toLowerCase().includes("knowledge")) {
      return "Your knowledge base looks ready.";
    }
    if (sid.includes("connected") || title.toLowerCase().includes("connected")) {
      return "All connected systems are ready.";
    }
    if (sid.includes("digital_workforce") || title.toLowerCase().includes("digital workforce")) {
      return "Workforce is stable. No coverage gaps detected.";
    }
    if (sid.includes("recent") || title.toLowerCase().includes("recent")) {
      return "No recent activity to review.";
    }

    return String(section.emptyState ?? "").trim() || "Everything looks good.";
  })();

  const isEmpty = cards.length === 0;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{section.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{section.subtitle}</div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <div className="text-xs text-muted-foreground hidden sm:block">priority: {section.priority}</div>
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "Hide" : isEmpty ? "Show" : "Show"}
          </button>
        </div>
      </div>

      <div className="mt-3">
        {expanded ? (
          cards.length === 0 ? (
            <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
              {emptyCopy}
            </div>
          ) : (
            <div className={layoutClass(String(section.layout ?? "single"))}>
              {cards.map((cid) => (
                <MissionControlCardRenderer key={String(cid)} cardId={String(cid)} />
              ))}
            </div>
          )
        ) : (
          // Collapsed empty sections do not dominate the page; keep only a short line.
          isEmpty ? (
            <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">{emptyCopy}</div>
          ) : null
        )}

        {actions.length > 0 ? (
          expanded ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((aid) => (
                <MissionControlActionRenderer key={String(aid)} actionId={String(aid)} />
              ))}
            </div>
          ) : null
        ) : null}
      </div>
    </section>
  );
}

