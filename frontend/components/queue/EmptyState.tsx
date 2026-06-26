import { Inbox } from "lucide-react";

import DesignEmptyState from "@/components/design-system/EmptyState";

export default function EmptyState() {
  return (
    <DesignEmptyState
      icon={<Inbox className="h-5 w-5" aria-hidden="true" />}
      title="Your Digital Workforce is caught up."
      description="There is nothing requiring your attention."
    />
  );
}

