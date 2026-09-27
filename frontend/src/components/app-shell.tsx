import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  ClipboardList,
  HandHeart,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Package,
  PieChart,
  Truck,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard };

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "Usuarios", to: "/usuarios", icon: Users },
    { label: "Empresas", to: "/empresas", icon: Building2 },
    { label: "Organizaciones", to: "/organizaciones", icon: HandHeart },
    { label: "Donaciones", to: "/donaciones", icon: Package },
    { label: "Solicitudes", to: "/solicitudes", icon: ClipboardList },
    { label: "Entregas", to: "/entregas", icon: Truck },
    { label: "Reportes", to: "/reportes", icon: PieChart },
  ],
  empresa: [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "Mis donaciones", to: "/mis-donaciones", icon: Package },
    { label: "Crear donación", to: "/crear-donacion", icon: PackagePlus },
    { label: "Solicitudes recibidas", to: "/solicitudes", icon: ClipboardList },
    { label: "Entregas", to: "/entregas", icon: Truck },
    { label: "Reportes", to: "/reportes", icon: PieChart },
    { label: "Perfil", to: "/perfil", icon: UserCircle },
  ],
  organizacion: [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "Donaciones disponibles", to: "/donaciones", icon: Package },
    { label: "Mis solicitudes", to: "/mis-solicitudes", icon: ClipboardList },
    { label: "Seguimiento", to: "/entregas", icon: Truck },
    { label: "Perfil", to: "/perfil", icon: UserCircle },
  ],
};

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { currentUser, hydrated, logout } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (hydrated && !currentUser) navigate({ to: "/" });
  }, [hydrated, currentUser, navigate]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!hydrated || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando plataforma…
      </div>
    );
  }

  const items = NAV[currentUser.rol];
  const initials = currentUser.nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  const sidebar = (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <HandHeart className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">DonaRed</p>
          <p className="text-xs opacity-70">Donaciones con impacto</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "opacity-80 hover:bg-sidebar-accent/60 hover:opacity-100",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-sidebar-border px-3 py-4">
        <button
          onClick={() => {
            logout();
            navigate({ to: "/" });
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm opacity-80 transition-colors hover:bg-sidebar-accent/60 hover:opacity-100"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="relative h-full">
            {sidebar}
            <button
              onClick={() => setOpen(false)}
              className="absolute -right-10 top-4 grid size-8 place-items-center rounded-lg bg-card text-foreground"
              aria-label="Cerrar menú"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="hidden items-center gap-2 sm:flex">{actions}</div>
          <NotificationBell />
          <div className="flex items-center gap-2.5 border-l pl-3">
            <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </div>
            <div className="hidden text-right leading-tight md:block">
              <p className="text-sm font-medium">{currentUser.nombre}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[currentUser.rol]}</p>
            </div>
          </div>
        </header>
        {actions && <div className="flex gap-2 px-4 pt-4 sm:hidden">{actions}</div>}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
