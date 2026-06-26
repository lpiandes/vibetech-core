import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

export default function SecondaryButton({
  children,
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <Button
      {...props}
      variant="outline"
      className={className}
      // neutral CTA style for secondary actions.
    >
      {children}
    </Button>
  );
}

