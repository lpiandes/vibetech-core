import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  Mail,
  Sparkles,
  Sun,
  Users,
  Activity,
  Plug,
} from "lucide-react";

import { deriveSidebarNavItems } from "./workspaceShellDerivations";

function iconForName(iconName: string | null): ReactNode {
  switch (iconName) {
    case "dashboard":
      return <LayoutDashboard className="h-4 w-4" />;
    case "users":
      return <Users className="h-4 w-4" />;
    case "inbox":
      return <ClipboardList className="h-4 w-4" />;
    case "chart":
      return <BarChart3 className="h-4 w-4" />;
    case "book":
      return <BookOpen className="h-4 w-4" />;
    case "sparkles":
      return <Sparkles className="h-4 w-4" />;
    case "sun":
      return <Sun className="h-4 w-4" />;
    case "mail":
      return <Mail className="h-4 w-4" />;
    case "plug":
      return <Plug className="h-4 w-4" />;
    case "activity-health":
      return <Activity className="h-4 w-4" />;
    default:
      return <LineChart className="h-4 w-4" />;
  }
}

export default function NavigationRenderer({
  workspaceViewModel,
}: {
  workspaceViewModel: any;
}) {
  const items = deriveSidebarNavItems(workspaceViewModel);

  return (
    <div className="flex min-h-screen flex-col border-r border-border bg-background">
      <div className="flex h-16 items-center px-5">
        {/* Keep existing logo visual; routing/nav comes from view model */}
        <div className="h-9 w-9 rounded-2xl border border-foreground/10 bg-foreground/5 shadow-sm" />
        <div className="leading-tight ml-3">
          <div className="text-sm font-semibold tracking-tight">VIBETech</div>
          <div className="text-xs text-muted-foreground">Workspace</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 pb-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5"
          >
            <span className="text-muted-foreground">{iconForName(item.iconName)}</span>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

