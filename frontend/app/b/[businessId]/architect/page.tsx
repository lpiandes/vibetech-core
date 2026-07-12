import { Suspense } from "react";

import InBusinessArchitect from "@/components/architect/InBusinessArchitect";
import {
  ArchitectPanel,
  ArchitectShell,
  ArchitectSkeleton,
  ThinkingDots,
} from "@/components/architect/ArchitectPrimitives";

export default async function BusinessArchitectPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return (
    <Suspense
      fallback={(
        <ArchitectShell maxWidth={1100}>
          <ArchitectPanel style={{ display: "grid", gap: 14 }}>
            <ThinkingDots label="Opening Ask VIBETech" />
            <ArchitectSkeleton height={28} width="40%" />
            <ArchitectSkeleton height={160} />
          </ArchitectPanel>
        </ArchitectShell>
      )}
    >
      <InBusinessArchitect businessId={businessId} />
    </Suspense>
  );
}
