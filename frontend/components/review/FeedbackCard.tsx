"use client";

import { useId } from "react";

export default function FeedbackCard() {
  const labelId = useId();

  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">Feedback</div>

      <div className="mt-4">
        <label
          id={labelId}
          className="sr-only"
        >
          Leave feedback for your Digital Employee
        </label>

        <textarea
          aria-labelledby={labelId}
          placeholder="Leave feedback for your Digital Employee..."
          className="min-h-[140px] w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 font-sans text-sm leading-6 text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Visual-only placeholder. No functionality in this sprint.
      </div>
    </section>
  );
}

