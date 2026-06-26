import type { InputHTMLAttributes } from "react";

export default function SearchInput({
  placeholder = "Search",
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      className={[
        "h-10 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground shadow-sm outline-none transition",
        "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/70",
        className ?? "",
      ].join(" ")}
      {...props}
      aria-label={props["aria-label"] ?? placeholder}
    />
  );
}

