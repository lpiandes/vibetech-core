import { Suspense } from "react";
import ArchitectHome from "@/components/architect/ArchitectHome";

export default function ArchitectHomePage() {
  return (
    <Suspense fallback={null}>
      <ArchitectHome />
    </Suspense>
  );
}
