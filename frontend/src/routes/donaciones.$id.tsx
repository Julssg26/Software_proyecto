import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { TrackingStepper } from "@/components/tracking-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/donaciones/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de la donación | DonaRed" },
      {
        name: "description",
        content:
          "Información completa de la donación, historial de estados y seguimiento de la entrega.",
      },
      { property: "og:title", content: "Detalle de la donación | DonaRed" },
      {
        property: "og:description",
        content: "Revisa el detalle, el historial y el seguimiento de la donación.",
      },
    ],
  }),
  component: DonacionDetallePage,
});

function DonacionDetallePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const {
    donations,
    requests,
    currentUser,
    requestDonation,
    markShipped,
    confirmReceipt,
    approveRequest,
    rejectRequest,
  } = useStore();
  const [mensaje, setMensaje] = useState("");

  const donation = donations.find((d) => d.id === id);

  if (!donation) {
    return (
      <AppShell title="Donación no encontrada">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Esta donación ya no existe.{" "}
            <Link to="/donaciones" className="text-primary underline">
              Volver al catálogo
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const rol = currentUser?.rol;
  const esDueña = currentUser?.entidadId === donation.empresaId;
  const solicitudes = requests.filter((r) => r.donacionId === donation.id);
  const miSolicitud = solicitudes.find((r) => r.orgId === currentUser?.entidadId);
  const pendiente = solicitudes.find((r) => r.estado === "Pendiente");

  return (
    <AppShell title={donation.nombre} subtitle={`Publicada por ${donation.empresaNombre}`}>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate({ to: "/donaciones" })}>
        <ArrowLeft className="size-4" /> Volver
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Información del recurso</CardTitle>
              <StatusBadge status={donation.estado} />
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{donation.descripcion}</p>
              <dl className="grid gap-4 sm:grid-cols-3">
                {[
                  ["Categoría", donation.categoria],
                  ["Cantidad", `${donation.cantidad} ${donation.unidad}`],
                  ["Vigencia", donation.vigencia || "Sin fecha"],
                  ["Publicada", donation.fecha],
                  ["Empresa", donation.empresaNombre],
                  ["Observaciones", donation.observaciones || "Sin observaciones"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-sm font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seguimiento de la entrega</CardTitle>
            </CardHeader>
            <CardContent>
              <TrackingStepper estado={donation.estado} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de estados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {donation.historial
                .slice()
                .reverse()
                .map((h, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <StatusBadge status={h.estado} />
                    <div className="min-w-0">
                      <p className="text-sm">{h.nota}</p>
                      <p className="text-xs text-muted-foreground">{h.fecha}</p>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {rol === "organizacion" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Solicitar esta donación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {miSolicitud ? (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">Ya enviaste una solicitud.</p>
                    <StatusBadge status={miSolicitud.estado} />
                    {miSolicitud.estado === "En camino" && (
                      <Button
                        className="w-full"
                        onClick={() => {
                          confirmReceipt(donation.id);
                          toast.success("Recepción confirmada, ¡gracias!");
                        }}
                      >
                        Confirmar recepción
                      </Button>
                    )}
                  </div>
                ) : donation.estado === "Disponible" ? (
                  <>
                    <Textarea
                      rows={4}
                      placeholder="Cuéntale a la empresa cómo usarán el recurso y cuántas personas beneficia."
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                    />
                    <Button
                      className="w-full"
                      onClick={() => {
                        requestDonation(donation.id, mensaje.trim() || "Solicitud sin mensaje adicional");
                        toast.success("Solicitud enviada a la empresa donante");
                        setMensaje("");
                      }}
                    >
                      Enviar solicitud
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Esta donación ya está comprometida con otra organización.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {(esDueña || rol === "admin") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Solicitudes recibidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {solicitudes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Todavía sin solicitudes.</p>
                )}
                {solicitudes.map((r) => (
                  <div key={r.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{r.orgNombre}</p>
                      <StatusBadge status={r.estado} />
                    </div>
                    <p className="text-xs text-muted-foreground">{r.mensaje}</p>
                    {esDueña && r.estado === "Pendiente" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            approveRequest(r.id);
                            toast.success("Solicitud aprobada");
                          }}
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            rejectRequest(r.id);
                            toast("Solicitud rechazada");
                          }}
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {esDueña && donation.estado === "Aprobada" && !pendiente && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      markShipped(donation.id);
                      toast.success("Donación marcada como enviada");
                    }}
                  >
                    Marcar como enviada
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
