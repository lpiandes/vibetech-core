"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cockpitColors, radius, spacing, typography } from "@/design/tokens";

function safeArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: cockpitColors.panel,
        border: `1px solid ${cockpitColors.panelBorder}`,
        borderRadius: radius.medium,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div style={{ color: cockpitColors.textMuted, fontSize: 13 }}>{label}</div>;
}

function RowLink({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} style={{ color: cockpitColors.accent, textDecoration: "none" }}>
      {children}
    </Link>
  );
}

export default function RelationshipOperationsIntelligenceLayout({ viewModel }: { viewModel: any }) {
  const metrics = safeArray(viewModel?.metrics);
  const outcomeMix = safeArray(viewModel?.outcomeMix);
  const propertyDemand = safeArray(viewModel?.propertyDemand);
  const workload = safeArray(viewModel?.assigneeWorkload);
  const stale = safeArray(viewModel?.oldOpenWork);
  const repeatedNoResponse = safeArray(viewModel?.repeatedNoResponse);
  const futureFollowUps = safeArray(viewModel?.futureFollowUps);

  return (
    <main style={{ display: "grid", gap: 18, padding: spacing.lg }}>
      <section>
        <div style={{ ...typography.sectionTitle, color: cockpitColors.textPrimary }}>Relationship operations</div>
        <div style={{ color: cockpitColors.textMuted, fontSize: 13, marginTop: 4 }}>
          Read-only operating intelligence from follow-up work, outcomes, property links, assignments, and prepared drafts.
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {metrics.map((metric: any) => (
          <Card key={String(metric.id)}>
            <div style={{ color: cockpitColors.textMuted, fontSize: 12 }}>{String(metric.label)}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
              <RowLink href={metric.href}>{String(metric.value ?? 0)}</RowLink>
            </div>
          </Card>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Card>
          <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>Outcome mix</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {outcomeMix.length ? outcomeMix.map((row: any) => (
              <div key={String(row.id)} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>{String(row.label)}</span>
                <strong>{String(row.count)}</strong>
              </div>
            )) : <Empty label="No recorded follow-up outcomes yet." />}
          </div>
        </Card>

        <Card>
          <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>Assignee workload</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {workload.length ? workload.map((row: any) => (
              <div key={String(row.assigneeId)} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>{String(row.assigneeName)}</span>
                <strong>{String(row.openCount)}</strong>
              </div>
            )) : <Empty label="No open relationship follow-up work." />}
          </div>
        </Card>

        <Card>
          <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>Property demand</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {propertyDemand.length ? propertyDemand.map((row: any) => (
              <div key={String(row.subjectId)} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <RowLink href={row.href}>{String(row.subjectName)}</RowLink>
                <strong>{String(row.interestedCount)}</strong>
              </div>
            )) : <Empty label="No canonical property interest links yet." />}
          </div>
        </Card>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <Card>
          <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>Aging follow-up work</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {stale.length ? stale.map((row: any) => (
              <div key={String(row.workId)} style={{ display: "grid", gap: 2 }}>
                <RowLink href={row.href}>{String(row.title)}</RowLink>
                <span style={{ color: cockpitColors.textMuted, fontSize: 12 }}>
                  {String(row.partyName ?? "Unknown contact")} · {String(row.assigneeName)} · {row.ageDays ?? 0} days
                </span>
              </div>
            )) : <Empty label="No active follow-up work needs attention." />}
          </div>
        </Card>

        <Card>
          <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>Repeated no-response</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {repeatedNoResponse.length ? repeatedNoResponse.map((row: any) => (
              <div key={String(row.id)} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <RowLink href={row.href}>{String(row.partyName)}</RowLink>
                <strong>{String(row.count)}</strong>
              </div>
            )) : <Empty label="No contact has repeated no-response outcomes." />}
          </div>
        </Card>

        <Card>
          <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>Scheduled follow-up</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {futureFollowUps.length ? futureFollowUps.map((row: any) => (
              <div key={String(row.interactionId)} style={{ display: "grid", gap: 2 }}>
                <span>{String(row.partyName ?? "Unknown contact")}</span>
                <span style={{ color: cockpitColors.textMuted, fontSize: 12 }}>{String(row.followUpAt)}</span>
              </div>
            )) : <Empty label="No future follow-up commitments recorded." />}
          </div>
        </Card>
      </section>
    </main>
  );
}
