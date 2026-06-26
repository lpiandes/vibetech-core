import { UserRound } from "lucide-react";

export default function Avatar({
  name,
  size = 36,
}: {
  name?: string;
  size?: number;
}) {
  const initials = name
    ? name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
    : "";

  return (
    <div
      className="flex items-center justify-center rounded-full border border-border bg-foreground/5 text-foreground shadow-sm"
      style={{ width: size, height: size }}
      aria-label={name ? `Avatar for ${name}` : "Avatar"}
    >
      {initials ? (
        <span className="text-xs font-semibold tracking-tight">{initials}</span>
      ) : (
        <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}

