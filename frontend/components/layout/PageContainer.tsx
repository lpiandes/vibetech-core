import type { ReactNode } from "react";

export default function PageContainer({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-10 py-12">
      {children}
    </section>
  );
}

