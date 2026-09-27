import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/mis-solicitudes")({
  head: () => ({
    meta: [
      { title: "Mis solicitudes | DonaRed" },
      {
        name: "description",
        content: "Da seguimiento a las solicitudes enviadas por tu organización social.",
      },
      { property: "og:title", content: "Mis solicitudes | DonaRed" },
      {
        property: "og:description",
        content: "Estado y seguimiento de las solicitudes de tu organización.",
      },
    ],
  }),
  component: MisSolicitudesPage,
});

function MisSolicitudesPage() {
  const { requests, currentUser, confirmReceipt, reportIncident } = useStore();
  const [incidenciaId, setIncidenciaId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState("");

  const mias = requests.filter((r) => r.orgId === currentUser?.entidadId);

  return (
    <AppShell title="Mis solicitudes" subtitle="Seguimiento de los recursos que has solicitado">
      <div className="grid gap-4 md:grid-cols-2">
        {mias.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{r.donacionNombre}</h2>
                  <p className="text-xs text-muted-foreground">
                    {r.empresaNombre} · solicitada el {r.fecha}
                  </p>
                </div>
                <StatusBadge status={r.estado} />
              </div>
              <p className="text-sm text-muted-foreground">{r.mensaje}</p>
              {r.incidencia && (
                <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                  Incidencia reportada: {r.incidencia}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/donaciones/$id" params={{ id: r.donacionId }}>
                    Ver detalle
                  </Link>
                </Button>
                {["En camino", "Aprobada"].includes(r.estado) && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await confirmReceipt(r.donacionId);
                        toast.success("Recepción confirmada");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "No se pudo confirmar la recepción",
                        );
                      }
                    }}
                  >
                    Confirmar recepción
                  </Button>
                )}
                {r.estado !== "Rechazada" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      setIncidenciaId(r.id);
                      setDetalle("");
                    }}
                  >
                    Reportar incidencia
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {mias.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Aún no has enviado solicitudes.{" "}
          <Link to="/donaciones" className="text-primary underline">
            Explora las donaciones disponibles
          </Link>
        </p>
      )}

      <Dialog open={!!incidenciaId} onOpenChange={(o) => !o && setIncidenciaId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar incidencia</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={4}
            placeholder="Describe el problema con la entrega (faltantes, retraso, estado del producto…)"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
          />
          <Button
            onClick={async () => {
              if (!detalle.trim()) return;
              try {
                await reportIncident(incidenciaId!, detalle.trim());
                toast("Incidencia registrada, la empresa fue notificada");
                setIncidenciaId(null);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "No se pudo registrar la incidencia",
                );
              }
            }}
          >
            Enviar reporte
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
