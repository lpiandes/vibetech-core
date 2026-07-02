"use client";

import type { ReactNode } from "react";
import { Component } from "react";

export default class MissionControlErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message ?? err ?? "Mission Control failed to render.") };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-sm font-semibold">Mission Control</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Something went wrong while rendering Mission Control. Please refresh.
          </div>
          {this.state.message ? <div className="mt-2 text-xs text-muted-foreground">{this.state.message}</div> : null}
        </div>
      );
    }

    return this.props.children;
  }
}

