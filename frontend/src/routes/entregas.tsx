import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { TrackingStepper } from "@/components/tracking-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/entregas")({
  head: () => ({
    meta: [
      { title: "Entregas y seguimiento | DonaRed" },
      {
        name: "description",
        content:
          "Sigue el avance de cada entrega: aprobación, envío, recepción confirmada e incidencias.",
      },
      { property: "og:title", content: "Entregas y seguimiento | DonaRed" },
      {
        property: "og:description",
        content: "Estado de las entregas en curso y completadas de la red.",
      },
    ],
  }),
  component: EntregasPage,
});

function EntregasPage() {
  const { requests, donations, currentUser, markShipped, confirmReceipt } = useStore();

  const activas = requests.filter((r) => {
    const mine =
      currentUser?.rol === "admin" ||
      r.empresaId === currentUser?.entidadId ||
      r.orgId === currentUser?.entidadId;
    return mine && ["Aprobada", "En camino", "Entregada", "Incidencia"].includes(r.estado);
  });

  return (
    <AppShell
      title="Entregas"
      subtitle="Seguimiento del traslado de las donaciones aprobadas"
    >
      <div className="space-y-5">
        {activas.map((r) => {
          const d = donations.find((x) => x.id === r.donacionId);
          return (
            <Card key={r.id}>
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{r.donacionNombre}</h2>
                    <p className="text-xs text-muted-foreground">
                      {r.empresaNombre} → {r.orgNombre} · {r.fecha}
                    </p>
                  </div>
                  <StatusBadge status={r.estado} />
                </div>

                {d && <TrackingStepper estado={d.estado} />}

                {r.incidencia && (
                  <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    Incidencia: {r.incidencia}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/donaciones/$id" params={{ id: r.donacionId }}>
                      Ver donación
                    </Link>
                  </Button>
                  {currentUser?.rol === "empresa" && r.estado === "Aprobada" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        markShipped(r.donacionId);
                        toast.success("Donación marcada como enviada");
                      }}
                    >
                      Marcar como enviada
                    </Button>
                  )}
                  {currentUser?.rol === "organizacion" &&
                    ["Aprobada", "En camino"].includes(r.estado) && (
                      <Button
                        size="sm"
                        onClick={() => {
                          confirmReceipt(r.donacionId);
                          toast.success("Recepción confirmada");
                        }}
                      >
                        Confirmar recepción
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activas.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No hay entregas en curso por el momento.
        </p>
      )}
    </AppShell>
  );
}
