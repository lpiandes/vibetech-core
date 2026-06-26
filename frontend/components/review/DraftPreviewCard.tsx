export default function DraftPreviewCard({ draft }: { draft: string }) {
  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">
        Draft Preview
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background p-6">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Finished communication
        </div>

        <div className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground">
          {draft}
        </div>
      </div>
    </section>
  );
}

