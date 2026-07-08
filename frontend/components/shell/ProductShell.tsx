"use client";

import type { ReactNode } from "react";

import PageContainer from "@/components/layout/PageContainer";
import WorkspaceMainArea from "@/components/workspace/WorkspaceMainArea";
import { WorkspaceNavigationProvider } from "@/components/workspace/WorkspaceNavigationContext";
import NavPerfDebug from "@/components/workspace/NavPerfDebug";

import ShellSidebar from "./ShellSidebar";
import ShellTopBar from "./ShellTopBar";
import { cockpitColors } from "@/design/tokens";

export default function ProductShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceNavigationProvider>
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: cockpitColors.background,
          color: cockpitColors.textPrimary,
          display: "flex",
        }}
      >
        <aside
          style={{
            width: 288,
            flexShrink: 0,
            backgroundColor: cockpitColors.sidebar,
            borderRight: `1px solid ${cockpitColors.sidebarBorder}`,
            display: "flex",
            flexDirection: "column",
          }}
          className="hidden md:flex"
        >
          <ShellSidebar />
        </aside>

        <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column" }}>
          <ShellTopBar />
          <main style={{ flex: 1, overflow: "auto" }}>
            <PageContainer>
              <WorkspaceMainArea>{children}</WorkspaceMainArea>
            </PageContainer>
          </main>
        </div>
      </div>
      <NavPerfDebug />
    </WorkspaceNavigationProvider>
  );
}
