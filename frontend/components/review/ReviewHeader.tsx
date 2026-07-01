export default function ReviewHeader() {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Review Communication
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Can you approve this prepared communication?
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Review the prepared message and the employee’s recommendation. Approve when everything matches what the buyer should receive.
      </p>
    </div>
  );
}

