"use client";

export default function WorkspaceMainArea({ children }: { children: React.ReactNode }) {
  // Keep the current page visible during client navigation. Sidebar uses optimistic
  // active state via beginNavigation; route-level loading.tsx covers suspense gaps.
  return <>{children}</>;
}
