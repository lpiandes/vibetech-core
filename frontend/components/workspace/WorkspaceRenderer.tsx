import type { ReactNode } from "react";

import PageContainer from "@/components/layout/PageContainer";
import Topbar from "@/components/layout/Topbar";

import WorkspaceContextProvider from "./WorkspaceContext";
import NavigationRenderer from "./NavigationRenderer";
import ModuleRenderer from "./ModuleRenderer";

export default function WorkspaceRenderer({
  workspaceViewModel,
  children,
}: {
  workspaceViewModel: any;
  children: ReactNode;
}) {
  return (
    <WorkspaceContextProvider workspaceViewModel={workspaceViewModel}>
      <div className="min-h-screen w-full bg-background text-foreground">
        <div className="flex min-h-screen">
          <aside className="hidden md:flex md:w-72 md:shrink-0 md:flex-col">
            <NavigationRenderer workspaceViewModel={workspaceViewModel} />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="shrink-0">
              <Topbar />
            </header>

            <main className="flex-1">
              <PageContainer>
                <ModuleRenderer workspaceViewModel={workspaceViewModel}>
                  {children}
                </ModuleRenderer>
              </PageContainer>
            </main>
          </div>
        </div>
      </div>
    </WorkspaceContextProvider>
  );
}

