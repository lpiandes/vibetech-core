import SectionHeader from "@/components/design-system/SectionHeader";
import MetricCard from "@/components/design-system/MetricCard";
import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";

export default function ImpactMetrics() {
  const service = getWorkspaceService();
  const view = service.loadDashboard();
  const impact = view.impactMetrics;

  return (
    <section>
      <SectionHeader
        title="At a glance"
        subtitle="Property work ready for review."
      />

      <div className="mt-5 grid gap-3 opacity-90 sm:grid-cols-2">
        <MetricCard
          label="Hours Saved"
          value={impact.hoursSaved}
          suffix="hrs"
          footnote="Estimated savings from employee-ready work."
        />
        <MetricCard
          label="Drafts Created Today"
          value={impact.draftsCreatedToday}
          footnote="Draft outputs produced today and queued for review."
        />
        <MetricCard
          label="Pending Reviews"
          value={impact.pendingReviews}
          footnote="Work items currently awaiting governance review."
        />
        <MetricCard
          label="Estimated Value Created"
          value={impact.estimatedValueCreatedK}
          suffix="k"
          footnote="Projected value from improved turnaround and accuracy."
        />
      </div>
    </section>
  );
}

