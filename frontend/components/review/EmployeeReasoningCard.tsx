export default function EmployeeReasoningCard({
  recommendation,
}: {
  recommendation: string;
}) {
  const firstSentence = recommendation
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean)[0];

  const recommendationLine = firstSentence
    ? `${firstSentence}.`
    : recommendation;

  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">
        Why I Recommend This
      </div>

      <div className="mt-4 rounded-2xl bg-muted/30 px-5 py-5">
        <p className="text-sm font-semibold leading-7 text-foreground">
          {recommendationLine}
        </p>
      </div>

      <div className="mt-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Employee Progress
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          "Property Research",
          "Buyer Review",
          "Company Policy Check",
          "Draft Prepared",
        ].map((label) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2"
          >
            <span className="text-primary" aria-hidden="true">
              ✓
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-background px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Supporting notes
        </div>
        <p className="mt-2 text-sm leading-7 text-foreground">
          {recommendation}
        </p>
      </div>
    </section>
  );
}

