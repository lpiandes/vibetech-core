export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-9 w-9 rounded-2xl border border-border bg-foreground/5 shadow-sm" />
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">VIBETech</div>
        <div className="text-xs text-muted-foreground">Workspace</div>
      </div>
    </div>
  );
}

