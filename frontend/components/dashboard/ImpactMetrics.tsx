import SectionHeader from "@/components/design-system/SectionHeader";
import MetricCard from "@/components/design-system/MetricCard";
import { demoCompany } from "@/lib/company/demoCompany";

export default function ImpactMetrics() {
  const inquiries = demoCompany.companyData.inquiries;
  const inquiriesCount = inquiries.length;
  const draftsReadyForReview = inquiries.filter(
    (i) => i.status === "Needs Review" && i.draftResponseReady,
  );

  const avgResponseTimeMinutes = (() => {
    const times = draftsReadyForReview
      .map((i) => i.responseTimeMinutes)
      .filter((t): t is number => typeof t === "number");
    if (!times.length) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  })();

  return (
    <section>
      <SectionHeader
        title="At a glance"
        subtitle="Property work ready for review."
      />

      <div className="mt-5 grid gap-3 opacity-90 sm:grid-cols-2">
        <MetricCard
          label="Buyer inquiries"
          value={inquiriesCount}
          footnote="Captured while you were away."
        />
        <MetricCard
          label="Draft responses ready"
          value={draftsReadyForReview.length}
          footnote="Buyer responses are prepared for your review."
        />
        <MetricCard
          label="Average response time"
          value={avgResponseTimeMinutes}
          suffix="min"
          footnote="Measured from inquiry submission to draft readiness."
        />
        <MetricCard
          label="Hours saved"
          value={demoCompany.companyData.hoursSavedToday}
          suffix="hrs"
          footnote="Estimated savings from employee-ready work."
        />
      </div>
    </section>
  );
}

