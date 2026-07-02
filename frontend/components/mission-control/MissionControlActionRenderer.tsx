"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import { useContext } from "react";

function classForStyle(style: string | undefined) {
  switch (style) {
    case "primary":
      return "bg-primary text-primary-foreground hover:bg-primary/90";
    case "secondary":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/90";
    case "tertiary":
      return "bg-muted text-muted-foreground hover:bg-muted/90";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function MissionControlActionRenderer({
  actionId,
}: {
  actionId: string;
}) {
  const viewModel = useContext<MissionControlViewModel | null>(MissionControlViewModelContext);
  if (!viewModel) return null;

  const action = viewModel.actions?.find((a: any) => String(a.id) === String(actionId)) ?? null;
  if (!action) return null;

  const disabled = Boolean(action.disabled);
  const style = String(action.style ?? "");

  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        classForStyle(style),
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {action.label}
    </button>
  );
}

