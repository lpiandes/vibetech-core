import MetricCard from "@/components/design-system/MetricCard";

export default function ImpactMetrics() {
  return (
    <section>
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Hours Saved"
          value="42.6"
          suffix="hrs"
          footnote="Estimated time saved from employee-ready work."
        />
        <MetricCard
          label="Drafts Created Today"
          value="8"
          suffix=""
          footnote="Draft outputs produced today and queued for review."
        />
        <MetricCard
          label="Pending Reviews"
          value="5"
          suffix=""
          footnote="Work items currently awaiting reviewer governance."
        />
        <MetricCard
          label="Estimated Value Created"
          value="$18.4"
          suffix="k"
          footnote="Projected value from improved turnaround and accuracy."
        />
      </div>
    </section>
  );
}

