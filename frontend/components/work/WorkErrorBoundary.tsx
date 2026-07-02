"use client";

import type { ReactNode } from "react";
import { Component } from "react";

export default class WorkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message ?? err ?? "Work failed to render.") };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-sm font-semibold">Work</div>
          <div className="mt-2 text-sm text-muted-foreground">Something went wrong while rendering work. Please refresh.</div>
          {this.state.message ? <div className="mt-2 text-xs text-muted-foreground">{this.state.message}</div> : null}
        </div>
      );
    }

    return this.props.children;
  }
}

