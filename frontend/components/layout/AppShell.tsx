import type { ReactNode } from "react";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import PageContainer from "./PageContainer";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden md:flex md:w-72 md:shrink-0 md:flex-col">
          <Sidebar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0">
            <Topbar />
          </header>

          <main className="flex-1">
            <PageContainer>{children}</PageContainer>
          </main>
        </div>
      </div>
    </div>
  );
}

