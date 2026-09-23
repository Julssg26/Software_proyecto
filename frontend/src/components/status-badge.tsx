import { cn } from "@/lib/utils";
import type { DonationStatus, RequestStatus } from "@/lib/types";

const styles: Record<string, string> = {
  Disponible: "bg-primary/10 text-primary border-primary/25",
  Solicitada: "bg-accent/15 text-accent-foreground border-accent/35",
  Pendiente: "bg-warning/20 text-warning-foreground border-warning/40",
  Aprobada: "bg-info/15 text-info border-info/35",
  "En camino": "bg-accent/20 text-accent-foreground border-accent/40",
  Entregada: "bg-success/15 text-success border-success/35",
  Rechazada: "bg-destructive/10 text-destructive border-destructive/30",
  Incidencia: "bg-destructive/10 text-destructive border-destructive/30",
  Activo: "bg-success/15 text-success border-success/35",
  Inactivo: "bg-muted text-muted-foreground border-border",
  Verificada: "bg-success/15 text-success border-success/35",
  "En revisión": "bg-warning/20 text-warning-foreground border-warning/40",
  Suspendida: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusBadge({
  status,
  className,
}: {
  status: DonationStatus | RequestStatus | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        styles[status] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
