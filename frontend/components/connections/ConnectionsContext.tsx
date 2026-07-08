"use client";

import { createContext, useContext, type ReactNode } from "react";

export const ConnectionsViewModelContext = createContext<any>(null);

export function useConnectionsViewModel() {
  const ctx = useContext(ConnectionsViewModelContext);
  if (!ctx) throw new Error("ConnectionsViewModelContext missing");
  return ctx;
}

export default function ConnectionsContextProvider({ viewModel, children }: { viewModel: any; children: ReactNode }) {
  return <ConnectionsViewModelContext.Provider value={viewModel}>{children}</ConnectionsViewModelContext.Provider>;
}
