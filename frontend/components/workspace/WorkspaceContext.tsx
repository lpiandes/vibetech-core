// Next.js requires context creation to live in a Client Component.
"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type WorkspaceViewModel = any;

export const WorkspaceViewModelContext = createContext<WorkspaceViewModel | null>(null);

export default function WorkspaceContextProvider({
  workspaceViewModel,
  children,
}: {
  workspaceViewModel: WorkspaceViewModel;
  children: ReactNode;
}) {
  return (
    <WorkspaceViewModelContext.Provider value={workspaceViewModel}>
      {children}
    </WorkspaceViewModelContext.Provider>
  );
}

