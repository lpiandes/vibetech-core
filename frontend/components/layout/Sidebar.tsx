import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Users,
  Settings,
} from "lucide-react";

import Logo from "./Logo";

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "team", label: "My Team", icon: <Users className="h-4 w-4" /> },
  { id: "queue", label: "Work Queue", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "performance", label: "Performance", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export default function Sidebar() {
  const activeId = "dashboard";

  return (
    <div className="flex min-h-screen flex-col border-r border-border bg-background">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 pb-4">
        {navItems.slice(0, 4).map((item) => {
          const active = item.id === activeId;
          return (
            <div
              key={item.id}
              className={[
                "flex cursor-default items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-foreground/5",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              <span className={active ? "text-foreground" : "text-muted-foreground"}>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </div>
          );
        })}
      </nav>

      <div className="px-3 pb-5">
        <button
          type="button"
          className="flex w-full cursor-default items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm transition hover:bg-foreground/5"
        >
          <Settings className="h-4 w-4" />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
}

