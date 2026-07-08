"use client";

import type { ReactNode } from "react";

export default function ConnectionsErrorBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
