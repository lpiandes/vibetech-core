"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import { useContext } from "react";
import { Activity, AlertTriangle, BookOpen, FileText, Target } from "lucide-react";

function iconForSource(source: string) {
  switch (source) {
    case "company_health":
      return <Activity className="h-4 w-4" />;
    case "company_recommendations":
      return <FileText className="h-4 w-4" />;
    case "company_opportunities":
      return <Target className="h-4 w-4" />;
    case "company_brief":
      return <BookOpen className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
}

function badgeClassFor(badge: string) {
  switch (badge) {
    case "danger":
      return "bg-red-50 text-red-700 border-red-200 hover:bg-red-50";
    case "warning":
      return "bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-50";
    case "success":
      return "bg-green-50 text-green-800 border-green-200 hover:bg-green-50";
    case "action":
      return "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-50";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function priorityText(priority: string) {
  if (priority === "immediate") return "Immediate";
  if (priority === "soon") return "Soon";
  return "Later";
}

function metricTrendText(trend: string | null) {
  if (!trend) return "";
  return String(trend);
}

export default function MissionControlCardRenderer({ cardId }: { cardId: string }) {
  const viewModel = useContext<MissionControlViewModel | null>(MissionControlViewModelContext);
  if (!viewModel) return null;

  const card = viewModel.cards?.find((c: any) => String(c.id) === String(cardId)) ?? null;
  if (!card) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{iconForSource(String(card.source ?? ""))}</span>
            <div className="text-sm font-semibold truncate">{card.title}</div>
          </div>

          <div className="mt-1 text-xs text-muted-foreground">{card.subtitle}</div>
        </div>

        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${badgeClassFor(String(card.badge ?? "info"))}`}>
          {priorityText(String(card.priority ?? "later"))}
        </span>
      </div>

      <div className="mt-3 text-sm text-foreground/80">{card.body}</div>

      {typeof card.metric === "number" || card.metric === 0 ? (
        <div className="mt-2 text-xs text-muted-foreground">
          Metric: {card.metric}
          {metricTrendText(card.trend) ? ` (${metricTrendText(card.trend)})` : ""}
        </div>
      ) : null}

      {Array.isArray(card.actions) && card.actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {card.actions.map((aid: any) => (
            <button
              key={String(aid)}
              type="button"
              className="rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/80"
              disabled={true}
              aria-disabled="true"
            >
              {String(aid)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

