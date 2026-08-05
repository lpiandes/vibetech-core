"use client";

import { useOptionalWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import { brand } from "@/design/tokens";

/**
 * Thin top progress while a soft navigation is in flight.
 * Does not blank the page — previous content stays visible until the next route lands.
 */
export default function NavProgressBar() {
  const nav = useOptionalWorkspaceNavigation();
  if (!nav?.isNavigating) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 4000,
        pointerEvents: "none",
        background: brand.primaryGradient,
        backgroundSize: "200% 100%",
        animation: "vt-nav-progress 0.9s linear infinite",
      }}
    >
      <style>{`
        @keyframes vt-nav-progress {
          0% { background-position: 100% 0; opacity: 0.55; }
          50% { opacity: 1; }
          100% { background-position: 0% 0; opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
