"use client";

import type { ReactNode } from "react";

export default function SetupErrorBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
