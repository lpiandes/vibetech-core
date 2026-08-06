import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/operating/PageHeader";
import { Button } from "@/components/ui/button";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import GovernedLearningPanel from "./GovernedLearningPanel";
import EarnedAutonomyPanel from "./EarnedAutonomyPanel";
import AskVibeTechPrompt from "@/components/operating/AskVibeTechPrompt";

export type PresentedCompanyRuleContract = {
  employeeId: string;
  label: string;
  contractVersion: string;
  slaSummary: string;
  approvalSummary: string;
  proofSummary: string;
  contentHash?: string | null;
};

const EMPTY_MEMORY_COPY = "Not confirmed yet — confirm during launch or from Ask.";

type MemoryDomain = {
  title: string;
  value: string;
};

/**
 * Company Rules — governed Business Memory surface layered on Knowledge.
 * Contract presentations are computed on the server (hasher is Node-only).
 */
export default function CompanyRulesExperience({
  businessId,
  contracts = [],
  memoryValues = {},
  knowledgeSlot,
}: {
  businessId: string;
  contracts?: PresentedCompanyRuleContract[];
  /** Confirmed Business Memory values keyed by domain title — never invent. */
  memoryValues?: Partial<Record<string, string>>;
  knowledgeSlot: ReactNode;
}) {
  const base = `/b/${encodeURIComponent(businessId)}`;
  const memoryDomains: MemoryDomain[] = [
    { title: "Services", value: memoryValues.Services || EMPTY_MEMORY_COPY },
    { title: "Approved pricing boundaries", value: memoryValues["Approved pricing boundaries"] || EMPTY_MEMORY_COPY },
    { title: "Customer types", value: memoryValues["Customer types"] || EMPTY_MEMORY_COPY },
    { title: "Response-time promises", value: memoryValues["Response-time promises"] || EMPTY_MEMORY_COPY },
    { title: "Assignment rules", value: memoryValues["Assignment rules"] || EMPTY_MEMORY_COPY },
    { title: "Escalation rules", value: memoryValues["Escalation rules"] || EMPTY_MEMORY_COPY },
    { title: "Tone & communication", value: memoryValues["Tone & communication"] || EMPTY_MEMORY_COPY },
    { title: "Approval policies", value: memoryValues["Approval policies"] || EMPTY_MEMORY_COPY },
    { title: "Scheduling rules", value: memoryValues["Scheduling rules"] || EMPTY_MEMORY_COPY },
    { title: "Known exceptions", value: memoryValues["Known exceptions"] || EMPTY_MEMORY_COPY },
    { title: "Learned preferences", value: memoryValues["Learned preferences"] || EMPTY_MEMORY_COPY },
    {
      title: "Installed Operating Contracts",
      value: contracts.length
        ? `${contracts.length} installed: ${contracts.map((contract) => contract.label).join(", ")}`
        : EMPTY_MEMORY_COPY,
    },
  ];

  return (
    <div style={{ display: "grid", gap: spacing.xl }}>
      <div style={{ padding: `${spacing.lg} ${spacing.md}`, maxWidth: 960, margin: "0 auto", width: "100%", display: "grid", gap: spacing.lg }}>
        <PageHeader
          title="Company Rules"
          description="Services, approval boundaries, response promises, and installed Operating Contracts. Knowledge documents remain the evidence layer."
        />

        <AskVibeTechPrompt
          businessId={businessId}
          showSuggestions
          placeholder="Ask to confirm a rule, response promise, or approval policy"
          helperText="Confirmed answers become Company Rules — nothing applies until you approve."
        />

        <section style={panelStyle} aria-label="Service standard">
          <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700 }}>
            Service standard
          </h2>
          <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize, lineHeight: 1.5 }}>
            Managed Revenue Follow-Through promises: acknowledge eligible opportunities within the contracted SLA,
            assign an owner, record the next step after meetings, chase outstanding proposals on schedule,
            hand won work to delivery, and surface every exception to a person.
          </p>
          {contracts.length ? (
            <ul style={{ margin: `${spacing.md} 0 0`, paddingLeft: spacing.lg, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize, lineHeight: 1.55 }}>
              {contracts.map((contract) => (
                <li key={contract.employeeId}>
                  <strong style={{ color: cockpitColors.textPrimary }}>{contract.label}</strong>
                  {" — "}
                  {contract.slaSummary || "SLA recorded on the operating contract."}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: `${spacing.md} 0 0`, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
              Install Revenue Follow-Through to lock the written SLA on this business.
            </p>
          )}
        </section>

        <section style={panelStyle} aria-label="Business memory">
          <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700 }}>
            Business Memory
          </h2>
          <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textSecondary }}>
            These are the operating facts VIBETech should learn and cite. Empty domains stay
            explicit until they are confirmed during launch or through Ask.
          </p>
          <div
            style={{
              display: "grid",
              gap: spacing.md,
              marginTop: spacing.md,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            {memoryDomains.map((domain) => (
              <article
                key={domain.title}
                style={{
                  padding: spacing.md,
                  borderRadius: radius.medium,
                  border: `1px solid ${cockpitColors.panelBorder}`,
                  background: cockpitColors.panel,
                  display: "grid",
                  gap: spacing.xs,
                }}
              >
                <strong style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textPrimary }}>
                  {domain.title}
                </strong>
                <p
                  style={{
                    margin: 0,
                    color: domain.value === EMPTY_MEMORY_COPY
                      ? cockpitColors.textMuted
                      : cockpitColors.textSecondary,
                    fontSize: typography.meta.fontSize,
                    lineHeight: 1.5,
                  }}
                >
                  {domain.value}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section style={panelStyle} aria-label="Installed operating contracts">
          <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700 }}>
            Installed Operating Contracts
          </h2>
          {!contracts.length ? (
            <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textSecondary }}>
              No Revenue Follow-Through contract is installed yet. When it is, SLA and approval rules appear here.
            </p>
          ) : (
            <div style={{ display: "grid", gap: spacing.md, marginTop: spacing.md }}>
              {contracts.map((contract) => (
                <article
                  key={contract.employeeId}
                  style={{
                    padding: spacing.md,
                    borderRadius: radius.medium,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    display: "grid",
                    gap: spacing.sm,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                    <strong>{contract.label}</strong>
                    <span style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
                      v{contract.contractVersion}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
                    {contract.slaSummary}
                  </p>
                  <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
                    {contract.approvalSummary}
                  </p>
                  <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
                    {contract.proofSummary}
                  </p>
                  {contract.employeeId ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`${base}/team/${encodeURIComponent(contract.employeeId)}`}>
                        View operating contract
                      </Link>
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <GovernedLearningPanel businessId={businessId} />

        <EarnedAutonomyPanel businessId={businessId} />
      </div>

      <div>
        <div style={{ padding: `0 ${spacing.md}`, maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ margin: `0 0 ${spacing.md}`, fontSize: 18, fontWeight: 700 }}>
            Knowledge & policies
          </h2>
        </div>
        {knowledgeSlot}
      </div>
    </div>
  );
}

const panelStyle = {
  padding: spacing.lg,
  borderRadius: radius.large,
  background: cockpitColors.panel,
  border: `1px solid ${cockpitColors.panelBorder}`,
} as const;
