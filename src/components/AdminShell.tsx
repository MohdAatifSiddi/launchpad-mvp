import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, CreditCard, Receipt, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/admin/payments", label: "Payments", icon: Receipt },
];

export const AdminShell = ({ children, title }: { children: ReactNode; title: string }) => {
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-background">
      <aside className="sticky top-0 flex h-screen flex-col border-r border-border bg-card">
        <div className="border-b border-border p-5 flex items-center justify-between">
          <Logo />
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-mono uppercase tracking-wider text-accent">Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => navigate("/app")}>
            <ArrowLeft className="h-4 w-4" /> Back to app
          </Button>
        </div>
      </aside>
      <main className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background/85 px-8 backdrop-blur-md">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        </header>
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
};
