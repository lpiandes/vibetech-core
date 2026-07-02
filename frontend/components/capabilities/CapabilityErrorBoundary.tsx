"use client";

import type { ReactNode } from "react";
import { Component } from "react";

export default class CapabilityErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message ?? err ?? "Capabilities failed to render.") };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-sm font-semibold">Capabilities</div>
          <div className="mt-2 text-sm text-muted-foreground">Something went wrong while rendering capabilities. Please refresh.</div>
          {this.state.message ? <div className="mt-2 text-xs text-muted-foreground">{this.state.message}</div> : null}
        </div>
      );
    }

    return this.props.children;
  }
}

