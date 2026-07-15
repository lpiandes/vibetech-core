"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import PageContainer from "@/components/layout/PageContainer";
import WorkspaceMainArea from "@/components/workspace/WorkspaceMainArea";
import { WorkspaceNavigationProvider } from "@/components/workspace/WorkspaceNavigationContext";
import NavPerfDebug from "@/components/workspace/NavPerfDebug";
import PrimaryNavigation from "@/components/shell/PrimaryNavigation";
import ShellTopBar from "@/components/shell/ShellTopBar";
import MobileNavigationDrawer from "@/components/shell/MobileNavigationDrawer";
import AccountMenu from "@/components/shell/AccountMenu";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing } from "@/design/tokens";

/**
 * Unified business shell for `/b/[businessId]/**`.
 * Brand · switcher · primary nav · Needs Attention · account · mobile drawer.
 * Ask lives in the top bar (and mobile drawer), not the desktop sidebar foot.
 */
export default function BusinessShell({ children }: { children: ReactNode }) {
  const scope = useBusinessScope();
  const pathname = usePathname() ?? "";
  const isAskSurface = /\/architect(?:\/|$)/.test(pathname);
  const [needsAttentionCount, setNeedsAttentionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/businesses/${encodeURIComponent(scope.businessId)}/intelligence/candidates`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const open =
          typeof data.openCount === "number"
            ? data.openCount
            : Array.isArray(data.candidates)
              ? data.candidates.filter((c: { status?: string }) => !c.status || c.status === "open").length
              : 0;
        if (!cancelled) setNeedsAttentionCount(open);
      } catch {
        /* non-blocking */
      }
    }
    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [scope.businessId]);

  return (
    <WorkspaceNavigationProvider>
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: cockpitColors.background,
          color: cockpitColors.textPrimary,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <MobileNavigationDrawer needsAttentionCount={needsAttentionCount} />

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <aside
            aria-label="Business navigation"
            className="vt-desktop-only"
            style={{
              width: 280,
              flexShrink: 0,
              backgroundColor: cockpitColors.sidebar,
              borderRight: `1px solid ${cockpitColors.sidebarBorder}`,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <PrimaryNavigation needsAttentionCount={needsAttentionCount} />
            </div>
            <div
              style={{
                padding: spacing.md,
                borderTop: `1px solid ${cockpitColors.sidebarBorder}`,
              }}
            >
              <AccountMenu variant="dark" />
            </div>
          </aside>

      <div
        style={{
          display: "flex",
          minWidth: 0,
          flex: 1,
          flexDirection: "column",
          backgroundColor: isAskSurface ? "#070c10" : undefined,
        }}
      >
            <ShellTopBar attentionCount={needsAttentionCount} />
            <main
              id="main-content"
              className="vt-shell-main"
              style={{
                flex: 1,
                overflow: "auto",
                // Ask fills the content column — no cream PageContainer frame around it.
                backgroundColor: isAskSurface ? "#070c10" : undefined,
              }}
            >
              {isAskSurface ? (
                <WorkspaceMainArea>{children}</WorkspaceMainArea>
              ) : (
                <PageContainer>
                  <WorkspaceMainArea>{children}</WorkspaceMainArea>
                </PageContainer>
              )}
            </main>
          </div>
        </div>
      </div>
      <NavPerfDebug />
    </WorkspaceNavigationProvider>
  );
}
