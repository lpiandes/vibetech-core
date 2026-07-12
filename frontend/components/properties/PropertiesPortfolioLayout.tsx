"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import EmptyState from "@/components/product/EmptyState";
import ShellMetricStrip, { type ShellMetric } from "@/components/shell/ShellMetricStrip";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

import AddPropertyDialog from "./AddPropertyDialog";
import PropertyPortfolioTable, { type PropertyPortfolioRow } from "./PropertyPortfolioTable";

export type PortfolioPresentation = {
  metrics: Record<string, string>;
  portfolioTable: Record<string, string>;
  portfolioIndex: Record<string, string>;
  sections: Record<string, string>;
  emptyStates: Record<string, string>;
  unattributedCallout: string;
};

export type BusinessSubjectPortfolioIndex = {
  metrics: Array<{ id: string; label: string; value: string; href: string | null }>;
  totals: {
    totalProperties: number;
    unattributedInquiries: number;
  };
  rows: PropertyPortfolioRow[];
};

const METRIC_LABEL_KEYS: Record<string, keyof PortfolioPresentation["metrics"]> = {
  active_properties: "activeProperties",
  open_inquiries: "openInquiries",
  interested_prospects: "interestedProspects",
  open_follow_ups: "openFollowUps",
};

function formatUnattributedCallout(template: string, count: number) {
  return template.replace(/\{count\}/g, String(count));
}

export default function PropertiesPortfolioLayout({
  businessId,
  portfolio,
  presentation,
}: {
  businessId: string;
  portfolio: BusinessSubjectPortfolioIndex;
  presentation: PortfolioPresentation;
}) {
  const scope = useBusinessScope();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const openedFromQuery = useRef(false);

  const canCreate = scope.permissions.includes(PERMISSIONS.WORK_MANAGE);
  const hasProperties = portfolio.rows.length > 0;
  const showUnattributedCallout = portfolio.totals.unattributedInquiries > 0;

  const metricStrip: ShellMetric[] = portfolio.metrics.map((metric) => ({
    id: metric.id,
    label: metric.label || presentation.metrics[METRIC_LABEL_KEYS[metric.id] ?? metric.id] || metric.id,
    value: metric.value,
    href: metric.href,
  }));

  const portfolioIndex = presentation.portfolioIndex as Record<string, string>;
  const pageTitle = portfolioIndex.pageTitle ?? "Properties";
  const pageDescription =
    portfolioIndex.pageDescription ??
    "Properties VIBETech is supervising for this business.";
  const addLabel = portfolioIndex.addProperty ?? "Add property";
  const addFirstLabel = portfolioIndex.addFirstProperty ?? "Add your first property";
  const dialogTitle = portfolioIndex.createDialogTitle ?? "Add property";

  useEffect(() => {
    if (openedFromQuery.current) return;
    if (searchParams.get("add") === "1") {
      openedFromQuery.current = true;
      setShowAdd(true);
      router.replace(`/b/${businessId}/properties`, { scroll: false });
    }
  }, [searchParams, businessId, router]);

  function openAddDialog() {
    setShowAdd(true);
  }

  function closeAddDialog() {
    setShowAdd(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={canCreate ? <PrimaryButton onClick={openAddDialog}>{addLabel}</PrimaryButton> : undefined}
      />

      <ShellMetricStrip metrics={metricStrip} />

      {showUnattributedCallout ? (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.large,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panelElevated,
            fontSize: typography.caption.fontSize,
            color: cockpitColors.textSecondary,
            lineHeight: 1.5,
          }}
        >
          {formatUnattributedCallout(presentation.unattributedCallout, portfolio.totals.unattributedInquiries)}{" "}
          <Link href={`/b/${businessId}/work`} style={{ color: cockpitColors.accent, fontWeight: 600, textDecoration: "none" }}>
            Open Work
          </Link>
        </div>
      ) : null}

      {hasProperties ? (
        <PropertyPortfolioTable
          title={presentation.sections?.propertyIntelligence ?? "Property intelligence"}
          rows={portfolio.rows}
          columns={{
            property: presentation.portfolioTable.property ?? "Property",
            inquiries: presentation.portfolioTable.inquiries ?? "Inquiries",
            interested: presentation.portfolioTable.interested ?? "Interested",
            followUps: presentation.portfolioTable.followUps ?? "Open follow-ups",
            latestActivity: presentation.portfolioTable.latestActivity ?? "Latest activity",
          }}
        />
      ) : (
        <div
          style={{
            borderRadius: radius.large,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panel,
          }}
        >
          <EmptyState
            title={presentation.emptyStates.topPropertiesNone ?? "No properties yet"}
            description={
              presentation.emptyStates.portfolio ??
              "Add your first property to connect inquiries, interested prospects, follow-up work, and activity to a specific record."
            }
            action={
              canCreate ? <PrimaryButton onClick={openAddDialog}>{addFirstLabel}</PrimaryButton> : undefined
            }
          />
        </div>
      )}

      {showAdd ? (
        <AddPropertyDialog businessId={businessId} title={dialogTitle} onClose={closeAddDialog} />
      ) : null}
    </div>
  );
}
