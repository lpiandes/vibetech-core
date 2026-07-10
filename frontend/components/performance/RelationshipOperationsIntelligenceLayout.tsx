"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { cockpitColors, radius, spacing, typography } from "@/design/tokens";
import {
  buildCampaignWorkReviewHref,
  campaignPrepareDisabledReason,
  canPrepareCampaignTemplate,
} from "./campaignOperationsSemantics";

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

function RowLink({ href, children }: { href?: string | null; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} style={{ color: cockpitColors.accent, textDecoration: "none" }}>
      {children}
    </Link>
  );
}

export default function RelationshipOperationsIntelligenceLayout({ viewModel }: { viewModel: any }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, string>>({});
  const metrics = safeArray(viewModel?.metrics);
  const outcomeMix = safeArray(viewModel?.outcomeMix);
  const propertyDemand = safeArray(viewModel?.propertyDemand);
  const workload = safeArray(viewModel?.assigneeWorkload);
  const stale = safeArray(viewModel?.oldOpenWork);
  const repeatedNoResponse = safeArray(viewModel?.repeatedNoResponse);
  const futureFollowUps = safeArray(viewModel?.futureFollowUps);
  const campaignOps = viewModel?.campaignOperations ?? {};
  const recurringOperations = safeArray(campaignOps.operations);
  const campaigns = safeArray(campaignOps.campaigns);
  const campaignTemplates = safeArray(campaignOps.templates);

  async function prepareCampaign(url: string, body: Record<string, unknown>, actionKey: string) {
    if (busyId) return;
    setBusyId(actionKey);
    setActionError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error ?? "Could not prepare campaign work."));
      }
      const reviewHref = data?.workHref ?? buildCampaignWorkReviewHref(viewModel?.businessId ?? viewModel?.productContext?.identity?.businessId, data?.workId);
      if (!reviewHref) throw new Error("Campaign prepared, but no review Work was returned.");
      router.push(reviewHref);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not prepare campaign work.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main style={{ display: "grid", gap: 18, padding: spacing.lg }}>
      <section>
        <div style={{ ...typography.sectionTitle, color: cockpitColors.textPrimary }}>Relationship operations</div>
        <div style={{ color: cockpitColors.textMuted, fontSize: 13, marginTop: 4 }}>
          Operating intelligence from follow-up work, outcomes, property links, assignments, prepared drafts, recurring operations, and campaign readiness.
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

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ ...typography.sectionTitle, color: cockpitColors.textPrimary }}>Recurring operations</div>
          <div style={{ color: cockpitColors.textMuted, fontSize: 13, marginTop: 4 }}>
            VIBETech prepares recurring relationship operations as review work. Preparation is idempotent and drafts are not sent.
          </div>
          {actionError ? <div style={{ color: cockpitColors.warning, fontSize: 12, marginTop: 6 }}>{actionError}</div> : null}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {recurringOperations.length ? recurringOperations.map((operation: any) => {
            const prepareUrl = `/api/businesses/${String(viewModel?.businessId ?? viewModel?.productContext?.identity?.businessId ?? "")}/campaigns/prepare`;
            return (
              <Card key={String(operation.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>{String(operation.name)}</div>
                    <div style={{ color: cockpitColors.textMuted, fontSize: 12, marginTop: 4 }}>{String(operation.description)}</div>
                  </div>
                  <strong style={{ color: operation.enabled ? cockpitColors.accent : cockpitColors.textMuted, fontSize: 12 }}>
                    {operation.enabled ? "Enabled" : "Paused"}
                  </strong>
                </div>
                <div style={{ display: "grid", gap: 4, marginTop: 12, fontSize: 13 }}>
                  <div>Next due: <strong>{String(operation.nextDueAt)}</strong></div>
                  <div>Last occurrence: <strong>{String(operation.lastOccurrence ?? "None yet")}</strong></div>
                  <div>Status: <strong>{String(operation.status).replace(/_/g, " ")}</strong></div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {operation.workHref ? <RowLink href={operation.workHref}>Open related Work</RowLink> : null}
                  {!operation.workHref ? (
                    <button
                      type="button"
                      disabled={Boolean(busyId) || !operation.enabled || !operation.campaignTemplateId}
                      onClick={() => prepareCampaign(prepareUrl, {
                        operationId: operation.id,
                        campaignTemplateId: operation.campaignTemplateId,
                      }, `operation:${String(operation.id)}`)}
                      style={{
                        borderRadius: radius.medium,
                        border: `1px solid ${cockpitColors.panelBorder}`,
                        backgroundColor: cockpitColors.panel,
                        color: cockpitColors.accent,
                        padding: "7px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: !busyId && operation.enabled && operation.campaignTemplateId ? "pointer" : "default",
                      }}
                    >
                      {busyId === `operation:${String(operation.id)}` ? "Preparing..." : "Prepare current occurrence"}
                    </button>
                  ) : null}
                </div>
              </Card>
            );
          }) : <Empty label="No recurring operations configured." />}
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ ...typography.sectionTitle, color: cockpitColors.textPrimary }}>Campaign preparations</div>
          <div style={{ color: cockpitColors.textMuted, fontSize: 13, marginTop: 4 }}>
            Review campaign purpose, audiences, exclusions, draft status, approval state, and delivery truth.
          </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {campaigns.length ? campaigns.map((campaign: any) => {
            return (
              <Card key={String(campaign.workId)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>{String(campaign.campaignName)}</div>
                    <div style={{ color: cockpitColors.textMuted, fontSize: 12, marginTop: 4 }}>{String(campaign.purpose)}</div>
                    {campaign.subject ? (
                      <div style={{ color: cockpitColors.accent, fontSize: 12, marginTop: 4 }}>
                        Linked property: {String(campaign.subject.displayName)}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "grid", gap: 4, textAlign: "right", fontSize: 12 }}>
                    <strong>{String(campaign.approvalStatusLabel)}</strong>
                    <span>{String(campaign.communicationStatusLabel)}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
                  <div>Recipients: <strong>{String(campaign.audienceCount)}</strong></div>
                  <div>Excluded or suppressed: <strong>{String(campaign.excludedCount)}</strong></div>
                  <div>Occurrence: <strong>{String(campaign.occurrenceKey ?? "Manual")}</strong></div>
                </div>
                <div style={{ marginTop: 10, color: cockpitColors.textMuted, fontSize: 12 }}>{String(campaign.deliveryTruth)}</div>
                <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
                  {safeArray(campaign.recipients).slice(0, 4).map((recipient: any) => (
                    <div key={String(recipient.partyId)} style={{ fontSize: 13 }}>
                      <strong>{String(recipient.displayName)}</strong>
                      <span style={{ color: cockpitColors.textMuted }}> — {safeArray(recipient.reasons).join("; ") || "Evidence-backed recipient"}</span>
                    </div>
                  ))}
                  {safeArray(campaign.exclusions).slice(0, 3).map((exclusion: any) => (
                    <div key={String(exclusion.partyId)} style={{ fontSize: 12, color: cockpitColors.textMuted }}>
                      Excluded: {String(exclusion.displayName)} — {String(exclusion.reason)}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <RowLink href={campaign.href}>Open related Work</RowLink>
                </div>
              </Card>
            );
          }) : <Empty label="No campaign preparations yet." />}
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ ...typography.sectionTitle, color: cockpitColors.textPrimary }}>Campaign templates</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {campaignTemplates.map((template: any) => {
            const prepareUrl = `/api/businesses/${String(viewModel?.businessId ?? viewModel?.productContext?.identity?.businessId ?? "")}/campaigns/prepare`;
            const selectedSubjectId = selectedSubjects[String(template.id)] ?? "";
            const selectedPreview = safeArray(template.subjectAudiencePreviews).find((preview: any) => String(preview.subject?.id) === selectedSubjectId);
            const requiresSubject = Boolean(template.requiresSubject);
            const audienceCount = requiresSubject ? selectedPreview?.audienceCount : template.audienceCount;
            const excludedCount = requiresSubject ? selectedPreview?.excludedCount : template.excludedCount;
            const canPrepare = canPrepareCampaignTemplate(template, selectedSubjectId);
            const disabledReason = campaignPrepareDisabledReason(template, selectedSubjectId);
            const actionKey = `template:${String(template.id)}:${selectedSubjectId}`;
            return (
              <Card key={String(template.id)}>
                <div style={{ ...typography.cardTitle, color: cockpitColors.textPrimary }}>{String(template.name)}</div>
                <div style={{ color: cockpitColors.textMuted, fontSize: 12, marginTop: 4 }}>{String(template.purpose)}</div>
                {requiresSubject ? (
                  <label style={{ display: "grid", gap: 5, marginTop: 10, fontSize: 12, color: cockpitColors.textMuted }}>
                    Property
                    <select
                      value={selectedSubjectId}
                      onChange={(event) => setSelectedSubjects((prev) => ({ ...prev, [String(template.id)]: event.target.value }))}
                      style={{
                        borderRadius: radius.medium,
                        border: `1px solid ${cockpitColors.panelBorder}`,
                        backgroundColor: cockpitColors.panel,
                        color: cockpitColors.textPrimary,
                        padding: "7px 9px",
                      }}
                    >
                      <option value="">Select a property</option>
                      {safeArray(template.subjectOptions).map((subject: any) => (
                        <option key={String(subject.id)} value={String(subject.id)}>{String(subject.displayName)}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div style={{ display: "grid", gap: 4, marginTop: 10, fontSize: 13 }}>
                  <div>
                    Eligible now:{" "}
                    <strong>{requiresSubject && !selectedSubjectId ? "Select a property" : String(audienceCount ?? 0)}</strong>
                  </div>
                  <div>Excluded or suppressed: <strong>{requiresSubject && !selectedSubjectId ? "-" : String(excludedCount ?? 0)}</strong></div>
                  <div>Approval: <strong>{template.approvalRequired ? "Required" : "Not required"}</strong></div>
                </div>
                {requiresSubject && !selectedSubjectId ? (
                  <div style={{ marginTop: 8, color: cockpitColors.textMuted, fontSize: 12 }}>{String(template.emptyAudienceExplanation)}</div>
                ) : Number(audienceCount ?? 0) === 0 ? (
                  <div style={{ marginTop: 8, color: cockpitColors.textMuted, fontSize: 12 }}>{String(template.emptyAudienceExplanation)}</div>
                ) : null}
                {selectedPreview ? (
                  <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                    {safeArray(selectedPreview.includedPreview).slice(0, 3).map((recipient: any) => (
                      <div key={String(recipient.partyId)} style={{ fontSize: 12, color: cockpitColors.textSecondary }}>
                        {String(recipient.displayName)} — {safeArray(recipient.reasons).join("; ")}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div style={{ marginTop: 8, color: cockpitColors.textMuted, fontSize: 12 }}>
                  {safeArray(template.guardrails)[0] ?? "Uses canonical business evidence only."}
                </div>
                {disabledReason ? (
                  <div style={{ marginTop: 8, color: cockpitColors.textMuted, fontSize: 12 }}>{disabledReason}</div>
                ) : null}
                <button
                  type="button"
                  disabled={!canPrepare || Boolean(busyId)}
                  onClick={() => prepareCampaign(prepareUrl, {
                    campaignTemplateId: template.id,
                    subjectId: selectedSubjectId || undefined,
                  }, actionKey)}
                  style={{
                    marginTop: 10,
                    borderRadius: radius.medium,
                    border: `1px solid ${canPrepare ? cockpitColors.panelBorder : cockpitColors.panelBorder}`,
                    backgroundColor: cockpitColors.panel,
                    color: canPrepare ? cockpitColors.accent : cockpitColors.textMuted,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: canPrepare && !busyId ? "pointer" : "default",
                  }}
                >
                  {busyId === actionKey ? "Preparing..." : "Prepare review Work"}
                </button>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
