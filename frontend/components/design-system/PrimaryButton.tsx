import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

export default function PrimaryButton({
  children,
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <Button
      {...props}
      className={className}
      // shadcn default variant is the primary CTA style.
    >
      {children}
    </Button>
  );
}

