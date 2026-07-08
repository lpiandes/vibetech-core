"use client";

import Link from "next/link";

import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveEmptyState from "@/components/executive/ExecutiveEmptyState";
import MetricCard from "@/components/executive/MetricCard";
import StatusPill from "@/components/executive/StatusPill";

import { semanticColors, spacing, typography, radius } from "@/design/tokens";

function safeArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

function toneFromStatus(tone: string): "success" | "warning" | "danger" | "neutral" {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "critical") return "danger";
  return "neutral";
}

function priorityTone(badge: string): "danger" | "warning" {
  return badge === "critical" ? "danger" : "warning";
}

function employeeTone(status: string): "success" | "danger" | "warning" {
  if (status === "ACTIVE") return "success";
  if (status === "BLOCKED") return "danger";
  return "warning";
}

export default function CommandCenterExecutiveSections({ viewModel }: { viewModel: any }) {
  const hero = viewModel?.hero ?? viewModel?.commandCenter?.hero ?? {};
  const pulse = safeArray(viewModel?.pulse ?? viewModel?.commandCenter?.pulse);
  const attention = safeArray(viewModel?.needsYourAttention ?? viewModel?.commandCenter?.needsYourAttention);
  const handled = safeArray(viewModel?.handledByVibeTech ?? viewModel?.commandCenter?.handledByVibeTech);
  const workInProgress = viewModel?.workInProgress ?? viewModel?.commandCenter?.workInProgress ?? {};
  const workforce = viewModel?.digitalWorkforce ?? viewModel?.commandCenter?.digitalWorkforce ?? {};
  const activity = safeArray(viewModel?.businessActivity ?? viewModel?.commandCenter?.businessActivity);
  const health = safeArray(viewModel?.businessHealth ?? viewModel?.commandCenter?.businessHealth);
  const nextSteps = safeArray(viewModel?.whatHappensNext ?? viewModel?.commandCenter?.whatHappensNext);

  const inProgress = safeArray(workInProgress.in_progress);
  const digitalEmployees = safeArray(workforce.digitalEmployees);

  return (
    <ExecutiveStack gap="xl">
      <ExecutiveCard>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.lg, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: typography.caption.fontSize, color: semanticColors.textMuted, marginBottom: spacing.xs }}>
              {hero.operatingSystemTitle}
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 600, color: semanticColors.textPrimary, lineHeight: 1.2 }}>
              {hero.businessName}
            </div>
            <div style={{ marginTop: spacing.sm, color: semanticColors.textSecondary, maxWidth: 640, lineHeight: 1.5 }}>
              {hero.summary}
            </div>
          </div>
          <StatusPill tone={toneFromStatus(hero.statusTone)} label={hero.statusLabel ?? "Operating"} />
        </div>
      </ExecutiveCard>

      {pulse.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing.md }}>
          {pulse.map((m: any) => (
            <MetricCard key={String(m.id)} title={String(m.label)} value={String(m.value)} />
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: spacing.xl }}>
        <section>
          <ExecutiveHeader title={viewModel?.productContext?.pageLabels?.attention ?? "Needs decision"} subtitle="Decisions and exceptions only" />
          <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.md }}>
            {attention.length > 0 ? (
              attention.slice(0, 5).map((item: any) => (
                <ExecutiveCard key={String(item.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: semanticColors.textPrimary }}>{item.title}</div>
                      <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: 1.5 }}>
                        {item.summary}
                      </div>
                      <div style={{ marginTop: spacing.sm, color: semanticColors.textMuted, fontSize: typography.caption.fontSize }}>
                        {item.recommendedAction}
                      </div>
                    </div>
                    <StatusPill tone={priorityTone(item.priorityBadge)} label={item.priority} />
                  </div>
                </ExecutiveCard>
              ))
            ) : (
              <ExecutiveEmptyState title="All clear" message="Nothing requires your judgment right now. VIBETech is handling routine operations." />
            )}
            {attention.length > 5 ? (
              <Link href="/attention" style={{ color: semanticColors.accent, textDecoration: "none", fontSize: typography.caption.fontSize }}>
                View all {attention.length} items
              </Link>
            ) : attention.length > 0 ? (
              <Link href="/attention" style={{ color: semanticColors.accent, textDecoration: "none", fontSize: typography.caption.fontSize }}>
                Open attention center
              </Link>
            ) : null}
          </div>
        </section>

        <section>
          <ExecutiveHeader title="Handled by VIBETech" subtitle="Completed operational actions" />
          <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {handled.length > 0 ? (
              handled.slice(0, 6).map((item: any) => (
                <ExecutiveCard key={String(item.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize }}>
                        {item.actorName} · {item.result}
                      </div>
                    </div>
                    <div style={{ color: semanticColors.textMuted, fontSize: typography.caption.fontSize, whiteSpace: "nowrap" }}>
                      {item.occurredAt ? new Date(item.occurredAt).toLocaleString() : ""}
                    </div>
                  </div>
                </ExecutiveCard>
              ))
            ) : (
              <ExecutiveEmptyState title="No completed actions yet" message="As VIBETech handles work, completed actions will appear here." />
            )}
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: spacing.xl }}>
        <section>
          <ExecutiveHeader title="Work in Progress" subtitle="Active business work" />
          <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {inProgress.length > 0 ? (
              inProgress.slice(0, 5).map((w: any) => (
                <ExecutiveCard key={String(w.id)}>
                  <div style={{ fontWeight: 600 }}>{w.title}</div>
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textMuted, fontSize: typography.caption.fontSize }}>
                    {w.status} · {w.priority}
                  </div>
                </ExecutiveCard>
              ))
            ) : (
              <ExecutiveEmptyState title="No active work" message="Open work items will appear as requests are converted." />
            )}
            <Link href="/work" style={{ color: semanticColors.accent, textDecoration: "none", fontSize: typography.caption.fontSize }}>
              View work queue
            </Link>
          </div>
        </section>

        <section>
          <ExecutiveHeader title="Digital Workforce" subtitle="Who is handling what" />
          <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {digitalEmployees.length > 0 ? (
              digitalEmployees.slice(0, 4).map((emp: any) => (
                <ExecutiveCard key={String(emp.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{emp.name}</div>
                      <div style={{ color: semanticColors.textMuted, fontSize: typography.caption.fontSize }}>{emp.role}</div>
                      {emp.currentHandling ? (
                        <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize }}>
                          {emp.currentHandling}
                        </div>
                      ) : null}
                      {emp.blockedCapability ? (
                        <div style={{ marginTop: spacing.xs, color: semanticColors.warning, fontSize: typography.caption.fontSize }}>
                          Blocked: {emp.blockedCapability}
                        </div>
                      ) : null}
                    </div>
                    <StatusPill tone={employeeTone(emp.status)} label={emp.status} />
                  </div>
                </ExecutiveCard>
              ))
            ) : (
              <ExecutiveEmptyState title="No digital employees" message="Install an industry package to define digital employees." />
            )}
            <Link href="/team" style={{ color: semanticColors.accent, textDecoration: "none", fontSize: typography.caption.fontSize }}>
              View digital workforce
            </Link>
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: spacing.xl }}>
        <section>
          <ExecutiveHeader title="Business Health" subtitle="Problems with business impact" />
          <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {health.length > 0 ? (
              health.map((h: any) => (
                <ExecutiveCard key={String(h.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{h.title}</div>
                      <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize }}>{h.detail}</div>
                    </div>
                    <StatusPill tone={h.status === "critical" ? "danger" : "warning"} label={h.status} />
                  </div>
                </ExecutiveCard>
              ))
            ) : (
              <ExecutiveEmptyState title="Healthy" message="No business-impacting problems detected." />
            )}
          </div>
        </section>

        <section>
          <ExecutiveHeader title="What Happens Next" subtitle="Deterministic upcoming actions" />
          <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {nextSteps.length > 0 ? (
              nextSteps.map((n: any) => (
                <ExecutiveCard key={String(n.id)}>
                  <div style={{ fontWeight: 600 }}>{n.title}</div>
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize }}>{n.detail}</div>
                </ExecutiveCard>
              ))
            ) : (
              <ExecutiveEmptyState title="On track" message="No immediate next actions projected." />
            )}
          </div>
        </section>

        <section>
          <ExecutiveHeader title="Recent Activity" subtitle="Unified business timeline" />
          <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {activity.length > 0 ? (
              activity.slice(0, 5).map((a: any) => (
                <div
                  key={String(a.id)}
                  style={{
                    padding: spacing.sm,
                    borderRadius: radius.medium,
                    border: `1px solid ${semanticColors.border}`,
                    backgroundColor: semanticColors.surfaceSecondary,
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{a.title}</div>
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textMuted, fontSize: typography.caption.fontSize }}>
                    {a.actorName}
                  </div>
                </div>
              ))
            ) : (
              <ExecutiveEmptyState title="No activity yet" message="Business activity appears as operations run." />
            )}
          </div>
        </section>
      </div>
    </ExecutiveStack>
  );
}
