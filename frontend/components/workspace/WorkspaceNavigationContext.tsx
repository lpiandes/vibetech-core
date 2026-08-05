"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export type NavPerfTimestamps = {
  clickAt: number | null;
  activeAt: number | null;
  loadingAt: number | null;
  contentAt: number | null;
  targetHref: string | null;
};

type WorkspaceNavigationContextValue = {
  pathname: string;
  pendingHref: string | null;
  isNavigating: boolean;
  beginNavigation: (href: string) => void;
  cancelNavigation: () => void;
  displayPath: string;
  perf: NavPerfTimestamps;
};

const WorkspaceNavigationContext = createContext<WorkspaceNavigationContextValue | null>(null);

function normalizePath(path: string) {
  const p = String(path ?? "");
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

export function WorkspaceNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const normalizedPathname = normalizePath(pathname);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [perf, setPerf] = useState<NavPerfTimestamps>({
    clickAt: null,
    activeAt: null,
    loadingAt: null,
    contentAt: null,
    targetHref: null,
  });
  const loadingFrameRef = useRef<number | null>(null);
  const pathnameAtPendingRef = useRef<string | null>(null);

  const beginNavigation = useCallback((href: string) => {
    const target = normalizePath(href);
    if (target === normalizedPathname) return;

    const clickAt = performance.now();
    pathnameAtPendingRef.current = normalizedPathname;
    setPendingHref(target);
    setPerf({
      clickAt,
      activeAt: clickAt,
      loadingAt: clickAt,
      contentAt: null,
      targetHref: target,
    });

    if (loadingFrameRef.current !== null) cancelAnimationFrame(loadingFrameRef.current);
    loadingFrameRef.current = requestAnimationFrame(() => {
      setPerf((prev) => (prev.targetHref === target ? { ...prev, loadingAt: performance.now() } : prev));
    });
  }, [normalizedPathname]);

  const cancelNavigation = useCallback(() => {
    pathnameAtPendingRef.current = null;
    setPendingHref(null);
  }, []);

  useEffect(() => {
    if (!pendingHref) return;

    if (normalizePath(pendingHref) === normalizedPathname) {
      let cancelled = false;
      const target = pendingHref;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          setPerf((prev) => (prev.targetHref === target ? { ...prev, contentAt: performance.now() } : prev));
          setPendingHref(null);
          pathnameAtPendingRef.current = null;
        });
      });
      return () => {
        cancelled = true;
      };
    }

    // Path changed to somewhere other than the pending target (replace/back/redirect).
    // Keep optimistic highlight while still on the page where the click started.
    if (
      pathnameAtPendingRef.current != null
      && normalizedPathname !== pathnameAtPendingRef.current
      && normalizePath(pendingHref) !== normalizedPathname
    ) {
      setPendingHref(null);
      pathnameAtPendingRef.current = null;
    }
  }, [normalizedPathname, pendingHref]);
  useEffect(() => {
    return () => {
      if (loadingFrameRef.current !== null) cancelAnimationFrame(loadingFrameRef.current);
    };
  }, []);

  const isNavigating = pendingHref !== null;
  // Optimistic highlight: tab switches the instant you click. Content follows
  // as soon as the RSC payload lands (kept fast by skipping nav-path side effects).
  const displayPath = pendingHref ?? normalizedPathname;

  const value = useMemo(
    () => ({
      pathname: normalizedPathname,
      pendingHref,
      isNavigating,
      beginNavigation,
      cancelNavigation,
      displayPath,
      perf,
    }),
    [normalizedPathname, pendingHref, isNavigating, beginNavigation, cancelNavigation, displayPath, perf],
  );

  return <WorkspaceNavigationContext.Provider value={value}>{children}</WorkspaceNavigationContext.Provider>;
}

export function useWorkspaceNavigation() {
  const ctx = useContext(WorkspaceNavigationContext);
  if (!ctx) throw new Error("useWorkspaceNavigation requires WorkspaceNavigationProvider");
  return ctx;
}

/** Safe outside business workspace shells (e.g. /platform). */
export function useOptionalWorkspaceNavigation() {
  return useContext(WorkspaceNavigationContext);
}
