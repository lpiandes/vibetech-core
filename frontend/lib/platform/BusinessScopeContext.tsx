"use client";

import { createContext, useContext } from "react";

export type BusinessScope = {
  businessId: string;
  role: string;
  permissions: string[];
  businessName: string;
};

const BusinessScopeContext = createContext<BusinessScope | null>(null);

export function BusinessScopeProvider({ value, children }: { value: BusinessScope; children: React.ReactNode }) {
  return <BusinessScopeContext.Provider value={value}>{children}</BusinessScopeContext.Provider>;
}

export function useBusinessScope() {
  const ctx = useContext(BusinessScopeContext);
  if (!ctx) throw new Error("useBusinessScope requires BusinessScopeProvider");
  return ctx;
}
