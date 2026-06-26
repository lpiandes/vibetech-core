export default function EmployeeCapabilities({
  capabilities,
}: {
  capabilities: string[];
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Capabilities
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {capabilities.map((c) => (
          <span
            key={c}
            className="inline-flex items-center rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

