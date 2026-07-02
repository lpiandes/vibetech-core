"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import { useContext } from "react";
import { Activity, ShieldCheck, Target, Sparkles } from "lucide-react";

function statusColorSemantics(status: string) {
  switch (status) {
    case "danger":
      return { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" };
    case "warning":
      return { bg: "bg-yellow-50", text: "text-yellow-800", ring: "ring-yellow-200" };
    case "success":
      return { bg: "bg-green-50", text: "text-green-800", ring: "ring-green-200" };
    default:
      return { bg: "bg-muted", text: "text-muted-foreground", ring: "ring-border" };
  }
}

function iconForStatus(status: string) {
  switch (status) {
    case "danger":
      return <ShieldCheck className="h-4 w-4" />;
    case "warning":
      return <Target className="h-4 w-4" />;
    case "success":
      return <Activity className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

export default function MissionControlHero() {
  const viewModel = useContext<MissionControlViewModel | null>(MissionControlViewModelContext);
  if (!viewModel) return null;

  const hero = viewModel.hero;
  const semantics = statusColorSemantics(String(hero?.status ?? ""));
  const primaryAction = viewModel.hero?.primaryAction;

  const actionByLabel = (label: string) =>
    viewModel.actions?.find((a: any) => String(a.label) === String(label)) ?? null;

  const primaryActionView = primaryAction ? actionByLabel(primaryAction) : null;

  const secondaryActions = safeArray(hero?.secondaryActions).map(actionByLabel).filter(Boolean);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={["rounded-lg p-3 ring-1", semantics.bg, semantics.ring, semantics.text].join(" ")}>
          <div className="flex items-center gap-2">
            {iconForStatus(String(hero?.status ?? ""))}
            <div className="text-sm font-semibold">Mission Control</div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold leading-tight">{hero.title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{hero.subtitle}</div>
          {typeof hero.score === "number" ? (
            <div className="mt-3 text-xs text-muted-foreground">Health score: {hero.score}</div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {primaryActionView ? <ActionButton action={primaryActionView} /> : null}
            {secondaryActions.slice(0, 2).map((a: any) => (
              <ActionButton key={String(a.id)} action={a} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function safeArray(v: any) {
  return Array.isArray(v) ? v : [];
}

function ActionButton({ action }: { action: any }) {
  const disabled = Boolean(action.disabled);
  const style = String(action.style ?? "");
  const cls =
    style === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : style === "secondary"
        ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
        : "bg-muted text-muted-foreground hover:bg-muted/90";

  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        cls,
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {action.label}
    </button>
  );
}

