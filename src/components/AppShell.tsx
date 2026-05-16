import { forwardRef, ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { FileText, FolderOpen, Settings as SettingsIcon, LogOut, Search, ShieldCheck, LayoutDashboard, Sparkles, Gavel } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const NAV = [
  { to: "/app/research", label: "Research", icon: Search },
  { to: "/app/decide",   label: "Decision Engine", icon: Sparkles },
  { to: "/app/litigation", label: "Litigation Intel", icon: Gavel },
  { to: "/app/matters",  label: "Matters",  icon: FolderOpen },
  { to: "/app/drafts",   label: "Drafts",   icon: FileText },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

export const AppShell = forwardRef<HTMLDivElement, { children: ReactNode; title?: string; action?: ReactNode }>(({ children, title, action }, ref) => {
  const { user, signOut } = useAuth();
  const { sub, loading, isActive } = useSubscription();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (sub && !isActive && location.pathname !== "/pricing") {
      navigate("/pricing", { replace: true });
    }
  }, [loading, sub, isActive, location.pathname, navigate]);

  return (
    <div ref={ref} className="grid min-h-screen grid-cols-[260px_1fr] bg-hero">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border p-5">
          <Link to="/app"><Logo variant="light" /></Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  "mt-4 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors border-t border-sidebar-border pt-4",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 rounded-md bg-sidebar-accent/60 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-sidebar-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              {sub?.plan ? `${sub.plan} plan` : "No plan"}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate("/"))} className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-h-screen flex-col">
        {(title || action) && (
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-8 backdrop-blur-md">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-primary">{title}</h1>
            {action}
          </header>
        )}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
});

AppShell.displayName = "AppShell";
