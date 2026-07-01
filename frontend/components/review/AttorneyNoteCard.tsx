export default function AttorneyNoteCard({ note }: { note: string }) {
  const propertyMatch = note.match(
    /Property (Highlights|Summary):\s*([\s\S]*?)Buyer Considerations:\s*([\s\S]*)/i,
  );

  if (propertyMatch) {
    const propertyRaw = propertyMatch[2].trim();
    const considerationsRaw = propertyMatch[3].trim();

    return (
      <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
        <div className="text-sm font-semibold text-foreground">
          Property Highlights
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background px-5 py-4">
          <p className="text-sm leading-7 text-foreground whitespace-pre-wrap">
            {propertyRaw}
          </p>
        </div>

        <div className="mt-6 text-sm font-semibold text-foreground">
          Buyer Considerations
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-background px-5 py-4">
          <p className="text-sm leading-7 text-foreground whitespace-pre-wrap">
            {considerationsRaw}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">
        Property Highlights
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background px-5 py-4">
        <p className="text-sm leading-7 text-foreground">{note}</p>
      </div>
    </section>
  );
}

