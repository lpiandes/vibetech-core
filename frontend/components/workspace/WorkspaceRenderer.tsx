import type { ReactNode } from "react";

import PageContainer from "@/components/layout/PageContainer";
import Topbar from "@/components/layout/Topbar";

import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveDivider from "@/components/executive/ExecutiveDivider";

import WorkspaceContextProvider from "./WorkspaceContext";
import NavigationRenderer from "./NavigationRenderer";
import ModuleRenderer from "./ModuleRenderer";

import { semanticColors, spacing, typography, radius } from "@/design/tokens";

export default function WorkspaceRenderer({
  workspaceViewModel,
  children,
}: {
  workspaceViewModel: any;
  children: ReactNode;
}) {
  return (
    <WorkspaceContextProvider workspaceViewModel={workspaceViewModel}>
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: semanticColors.background,
          color: semanticColors.textPrimary,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside className="flex flex-col w-16 md:w-72" style={{ flexShrink: 0, padding: spacing.sm }}>
            <NavigationRenderer workspaceViewModel={workspaceViewModel} />
          </aside>

          <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column" }}>
            <header style={{ flexShrink: 0 }}>
              <Topbar />
            </header>

            <header style={{ padding: `${spacing.xl} ${spacing.xl} ${spacing.lg} ${spacing.xl}` }}>
              <ExecutiveSurface>
                <ExecutiveStack gap="sm">
                  <ExecutiveHeader title="Business Operating System" subtitle="Executive analytics, deterministic actions, calm focus." />
                  <ExecutiveDivider />
                </ExecutiveStack>
              </ExecutiveSurface>
            </header>

            <main style={{ flex: 1 }}>
              <PageContainer>
                <ModuleRenderer workspaceViewModel={workspaceViewModel}>{children}</ModuleRenderer>
              </PageContainer>
            </main>

            <footer
              style={{
                borderTop: `1px solid ${semanticColors.border}`,
                backgroundColor: semanticColors.background,
                paddingTop: spacing.md,
                paddingBottom: spacing.md,
              }}
            >
              <div style={{ textAlign: "center", color: semanticColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                Placeholder areas: notifications, search, quick actions. Shell is redesigned for executive clarity.
              </div>
            </footer>
          </div>
        </div>
      </div>
    </WorkspaceContextProvider>
  );
}

