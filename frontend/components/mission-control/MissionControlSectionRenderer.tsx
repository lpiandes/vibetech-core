"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import { useContext } from "react";
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

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{section.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{section.subtitle}</div>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">priority: {section.priority}</div>
      </div>

      <div className="mt-3">
        {cards.length === 0 ? (
          <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">{section.emptyState || "No items available."}</div>
        ) : (
          <div className={layoutClass(String(section.layout ?? "single"))}>
            {cards.map((cid) => (
              <MissionControlCardRenderer key={String(cid)} cardId={String(cid)} />
            ))}
          </div>
        )}

        {actions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((aid) => (
              <MissionControlActionRenderer key={String(aid)} actionId={String(aid)} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

