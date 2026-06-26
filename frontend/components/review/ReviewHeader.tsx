export default function ReviewHeader() {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Review Work
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Can I confidently approve this?
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Review the case context, attorney note, and the employee’s thinking.
        Approve when everything is aligned.
      </p>
    </div>
  );
}

