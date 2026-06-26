export default function ReviewHeader() {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Review Work
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Your Digital Employee completed work—needs your review
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Review the case context, attorney note, and the employee’s
        recommendation. Approve when everything looks correct.
      </p>
    </div>
  );
}

