export default function EmployeeReasoningCard({
  recommendation,
}: {
  recommendation: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">
        Employee Thinking
      </div>

      <div className="mt-4 rounded-2xl bg-muted/30 px-5 py-4">
        <p className="text-sm leading-7 text-foreground">{recommendation}</p>
      </div>
    </section>
  );
}

