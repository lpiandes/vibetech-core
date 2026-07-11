"use client";

import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import {
  Tables,
  DataGrid,
  Filters,
  SearchResults,
  SubjectBrowser,
} from "@/components/universal";

type RecordsView = {
  hasRecords: boolean;
  objects: Array<{
    id: string;
    label: string;
    archetypeId?: string | null;
    fieldCount: number;
    formCount: number;
    viewCount: number;
    fields: Array<{ key: string; label: string; fieldType: string; required?: boolean }>;
  }>;
  relationships: Array<{ id: string; label: string; from: string; to: string; cardinality?: string; kind?: string }>;
  forms: Array<{ id: string; label: string; objectId: string; kind: string }>;
  views: Array<{ id: string; label: string; objectId: string; viewType: string }>;
  searches: Array<{ id: string; label: string; objectId: string; kind: string; pinned?: boolean }>;
  reports: Array<{ id: string; label: string; objectId: string; kind: string }>;
  metrics: Array<{ id: string; label: string; value: string | number }>;
};

/**
 * Records workspace — objects, fields, forms, views, search, reports.
 * Uses universal components; no industry-specific form UI.
 */
export default function RecordsWorkspace({ records }: { records: RecordsView }) {
  if (!records?.hasRecords) {
    return (
      <ShellPanel title="Records" subtitle="Business objects">
        <div style={{ padding: spacing.md, color: cockpitColors.textMuted, lineHeight: 1.5 }}>
          Architect will recommend objects, fields, forms, and views when a Business OS is designed.
          Installed subject types appear here automatically.
        </div>
      </ShellPanel>
    );
  }

  const tableRows = records.objects.map((object) => ({
    id: object.id,
    name: object.label,
    detail: object.archetypeId
      ? `${object.fieldCount} fields · archetype ${String(object.archetypeId).replace(/_/g, " ")}`
      : `${object.fieldCount} fields`,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <ShellMetricStrip metrics={records.metrics as never} />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="Objects" subtitle="Universal business records">
          <SubjectBrowser items={records.objects.map((object) => ({
            id: object.id,
            label: object.label,
            summary: object.archetypeId ? String(object.archetypeId).replace(/_/g, " ") : "object",
            kind: "Object",
          }))} />
        </ShellPanel>

        <ShellPanel title="Relationships" subtitle="Links between objects">
          {records.relationships.length ? records.relationships.map((rel) => (
            <div key={rel.id} style={{ padding: `${spacing.xs}px 0`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
              <div style={{ fontWeight: 600 }}>{rel.label}</div>
              <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
                {rel.from} → {rel.to} · {rel.cardinality} · {rel.kind}
              </div>
            </div>
          )) : (
            <div style={{ color: cockpitColors.textMuted }}>No relationships yet.</div>
          )}
        </ShellPanel>
      </div>

      <ShellPanel title="Object catalog" subtitle="Table view">
        <Tables
          items={tableRows}
          columns={[
            { id: "name", label: "Object" },
            { id: "detail", label: "Details" },
          ]}
        />
      </ShellPanel>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="Forms" subtitle="Create · edit · view · more">
          {records.forms.slice(0, 12).map((form) => (
            <div key={form.id} style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, padding: `${spacing.xs}px 0` }}>
              <span>{form.label}</span>
              <StatusBadge label={form.kind.replace(/_/g, " ")} tone="neutral" />
            </div>
          ))}
        </ShellPanel>

        <ShellPanel title="Views" subtitle="List presentations">
          <DataGrid
            items={records.views.slice(0, 12).map((view) => ({
              id: view.id,
              label: view.label,
              status: view.viewType,
            }))}
            columns={[
              { id: "label", label: "View" },
              { id: "status", label: "Type" },
            ]}
          />
        </ShellPanel>

        <ShellPanel title="Search" subtitle="Global · saved · advanced">
          <Filters items={records.searches.slice(0, 8).map((search) => ({
            id: search.id,
            label: search.pinned ? `${search.label} (pinned)` : search.label,
          }))} />
          <div style={{ marginTop: spacing.sm }}>
            <SearchResults items={records.searches.slice(0, 6).map((search) => ({
              id: search.id,
              label: search.label,
              summary: search.kind,
            }))} />
          </div>
        </ShellPanel>

        <ShellPanel title="Reports" subtitle="Counts · totals · KPIs">
          {records.reports.slice(0, 10).map((report) => (
            <div key={report.id} style={{ padding: `${spacing.xs}px 0`, color: cockpitColors.textMuted }}>
              {report.label}
              <span style={{ marginLeft: spacing.sm }}>({report.kind})</span>
            </div>
          ))}
        </ShellPanel>
      </div>

      {records.objects[0]?.fields?.length ? (
        <ShellPanel title={`${records.objects[0].label} fields`} subtitle="Universal field types">
          <DataGrid
            items={records.objects[0].fields.map((field) => ({
              id: field.key,
              label: field.label,
              status: `${field.fieldType}${field.required ? " · required" : ""}`,
            }))}
            columns={[
              { id: "label", label: "Field" },
              { id: "status", label: "Type" },
            ]}
          />
        </ShellPanel>
      ) : null}
    </div>
  );
}
