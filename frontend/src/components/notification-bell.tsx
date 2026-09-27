import {
  Bell,
  CheckCheck,
  ClipboardList,
  PackageCheck,
  PackageX,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useStore } from "@/lib/store";
import type { NotificationType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ICON_BY_TYPE: Record<NotificationType, typeof Bell> = {
  new_request: ClipboardList,
  request_approved: PackageCheck,
  request_rejected: PackageX,
  donation_shipped: Truck,
  donation_received: PackageCheck,
  incident_reported: ShieldAlert,
};

export function NotificationBell() {
  const { notifications, unreadNotifications, markNotificationRead, markAllNotificationsRead } =
    useStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="size-5" />
          {unreadNotifications > 0 && (
            <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-medium">Notificaciones</p>
          {unreadNotifications > 0 && (
            <button
              onClick={() => void markAllNotificationsRead()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Marcar todas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No tienes notificaciones todavía
            </p>
          ) : (
            notifications.map((n) => {
              const Icon = ICON_BY_TYPE[n.type] ?? Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) void markNotificationRead(n.id);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/50",
                    !n.read && "bg-primary/[0.04]",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                      n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("truncate", !n.read && "font-medium")}>{n.title}</p>
                      {!n.read && (
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.fecha), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
