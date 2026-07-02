"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type RequestViewModel = any;

export const RequestViewModelContext = createContext<RequestViewModel | null>(null);

export default function RequestContextProvider({
  viewModel,
  children,
}: {
  viewModel: RequestViewModel;
  children: ReactNode;
}) {
  return <RequestViewModelContext.Provider value={viewModel}>{children}</RequestViewModelContext.Provider>;
}

