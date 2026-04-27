import { LayoutDashboard, Upload, GitMerge, BarChart3, Lightbulb, MessageSquare, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Upload Data", url: "/upload", icon: Upload },
  { title: "Conflicts", url: "/conflicts", icon: GitMerge },
  { title: "Optimization", url: "/comparison", icon: BarChart3 },
  { title: "AI Recommendations", url: "/recommendations", icon: Lightbulb },
  { title: "Aura Assistant", url: "/ai-chat", icon: MessageSquare },
  { title: "Access Control", url: "/access-control", icon: ShieldCheck },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground shrink-0">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
          I2I
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-sidebar-primary-foreground leading-tight">
            Idle2Income
          </span>
          <span className="text-[10px] font-medium text-primary/70 tracking-wide">
            Demo Ready
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.url === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.url);

          return (
            <Link
              key={item.url}
              to={item.url}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3">
        <p className="text-xs text-sidebar-foreground/50">
          Revenue Recovery Platform
        </p>
      </div>
    </aside>
  );
}
