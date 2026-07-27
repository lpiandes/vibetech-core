"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

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
  const router = useRouter();
  const isAskSurface = /\/architect(?:\/|$)/.test(pathname);
  const isHomeSurface = /\/home(?:\/|$|\?)/.test(pathname) || /\/b\/[^/]+\/?$/.test(pathname);
  const hasInstalledOs = Boolean(scope.installedBusinessOS?.drivenByBusinessOS);
  const packageAskBlocking = Boolean(scope.pendingPackageAsk) && isAskSurface;
  // Pre-install setup + package Ask: full-bleed — hide business chrome (left nav + top bar).
  const isSetupBuilder = (!hasInstalledOs && (isAskSurface || isHomeSurface)) || packageAskBlocking;
  const [needsAttentionCount, setNeedsAttentionCount] = useState(0);
  const refreshedAfterInstall = useRef(false);

  // After client-side Architect install, Next can reuse a stale /b/[id] layout where
  // installedBusinessOS is still null — Home renders live content but chrome stays hidden.
  useEffect(() => {
    if (hasInstalledOs || !isHomeSurface || refreshedAfterInstall.current) return;
    refreshedAfterInstall.current = true;
    router.refresh();
  }, [hasInstalledOs, isHomeSurface, router]);

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
          height: "100dvh",
          maxHeight: "100dvh",
          width: "100%",
          backgroundColor: cockpitColors.background,
          color: cockpitColors.textPrimary,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!isSetupBuilder ? (
          <MobileNavigationDrawer needsAttentionCount={needsAttentionCount} />
        ) : null}

        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {!isSetupBuilder ? (
            <aside
              aria-label="Business navigation"
              className="vt-desktop-only"
              style={{
                width: 280,
                flexShrink: 0,
                height: "100%",
                backgroundColor: cockpitColors.sidebar,
                borderRight: `1px solid ${cockpitColors.sidebarBorder}`,
                // Keep flex direction inlined; visibility is owned by .vt-desktop-only media query.
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <PrimaryNavigation needsAttentionCount={needsAttentionCount} />
              </div>
              <div
                style={{
                  padding: spacing.md,
                  borderTop: `1px solid ${cockpitColors.sidebarBorder}`,
                  flexShrink: 0,
                }}
              >
                <AccountMenu variant="dark" />
              </div>
            </aside>
          ) : null}

      <div
        style={{
          display: "flex",
          minWidth: 0,
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
          backgroundColor: isAskSurface ? "#070c10" : undefined,
        }}
      >
            {!isSetupBuilder ? <ShellTopBar attentionCount={needsAttentionCount} /> : null}
            <main
              id="main-content"
              className="vt-shell-main"
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                // Ask fills the content column — no cream PageContainer frame around it.
                backgroundColor: isAskSurface ? "#070c10" : undefined,
              }}
            >
              {isAskSurface || isSetupBuilder ? (
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
