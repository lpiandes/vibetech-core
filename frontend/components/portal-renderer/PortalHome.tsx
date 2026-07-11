"use client";

import DashboardRenderer from "./DashboardRenderer";
import EmptyStateRenderer from "./EmptyStateRenderer";
import ExecutiveHomeLayout from "@/components/home/ExecutiveHomeLayout";
import { selectHomeDashboardWidgets } from "@/lib/portal-renderer/composePortalModel.js";

/**
 * Portal home — prefers Business OS dashboard widgets; falls back to McBride executive home.
 */
export default function PortalHome({
  portalModel,
  executive,
  businessId,
  preferLegacyExecutive = false,
}: {
  portalModel: any;
  executive: any;
  businessId: string;
  preferLegacyExecutive?: boolean;
}) {
  const widgets = selectHomeDashboardWidgets(portalModel);
  const hasOsDashboard = Boolean(portalModel?.drivenByBusinessOS && widgets.length);

  // McBride continuity: when no OS dashboard widgets, keep proven executive layout.
  if (!hasOsDashboard || preferLegacyExecutive) {
    if (executive?.showOperatingDashboard) {
      return <ExecutiveHomeLayout executive={executive} businessId={businessId} />;
    }
    return null;
  }

  if (!executive?.showOperatingDashboard) {
    return (
      <EmptyStateRenderer
        title={portalModel?.homeDashboard?.label ?? "Home"}
        description="Complete setup to open your operating dashboard."
      />
    );
  }

  const projection = {
    businessId,
    metrics: executive.metrics ?? [],
    attention: executive.attention ?? [],
    workRows: executive.workMovingNow ?? [],
    workforce: executive.digitalWorkforce?.digitalEmployees ?? [],
    subjects: executive.topProperties ?? [],
    communications: executive.recentCommunications ?? [],
    readiness: executive.businessControlStatus ?? null,
    pipeline: executive.operatingStates ?? [],
    activity: executive.episodeFeed ?? [],
    alerts: executive.attention ?? [],
    charts: executive.metrics ?? [],
    calendar: [],
    emptyStates: executive.emptyStates ?? {},
    sections: executive.sections ?? {},
    portfolioTable: executive.portfolioTable,
  };

  return (
    <DashboardRenderer
      title={portalModel.homeDashboard?.label}
      widgets={widgets}
      projection={projection}
    />
  );
}
