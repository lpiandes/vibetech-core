"use client";

import React, { createContext, useContext } from "react";

export type InstalledBusinessOSScope = {
  drivenByBusinessOS: boolean;
  modules?: Array<Record<string, unknown>>;
  navigation?: Record<string, unknown> | null;
  roles?: Array<Record<string, unknown>>;
  dashboards?: Array<Record<string, unknown>>;
  homeDashboard?: Record<string, unknown> | null;
  terminology?: Record<string, unknown> | null;
  emptyStates?: any;
  primaryActions?: Array<{ id: string; label: string; href: string; moduleId?: string }>;
  subjectTypes?: string[];
  landingModuleId?: string;
  [key: string]: any;
};

export type BusinessScope = {
  businessId: string;
  role: string;
  permissions: string[];
  businessName: string;
  purchasedPackages?: string[];
  pendingPackageAsk?: {
    status: "required";
    packages: string[];
    createdAt: string;
    sessionId?: string | null;
  } | null;
  installedNavigation?: {
    modules?: Array<Record<string, unknown>>;
    navigation?: Record<string, unknown>;
    roles?: Array<Record<string, unknown>>;
    roleDefinitions?: Array<Record<string, unknown>>;
  } | null;
  installedBusinessOS?: InstalledBusinessOSScope | null;
  supportAccess?: {
    active: boolean;
    mode?: string | null;
    reason?: string | null;
  } | null;
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

/** Safe for surfaces that can render outside a business shell (tests, workspace demo). */
export function useOptionalBusinessScope() {
  return useContext(BusinessScopeContext);
}
