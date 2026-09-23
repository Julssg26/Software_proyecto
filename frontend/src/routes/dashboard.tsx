import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  ClipboardList,
  HandHeart,
  Package,
  PackageCheck,
  Truck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel principal | DonaRed" },
      {
        name: "description",
        content:
          "Resumen de donaciones publicadas, solicitudes y entregas de la red DonaRed.",
      },
      { property: "og:title", content: "Panel principal | DonaRed" },
      {
        property: "og:description",
        content: "Indicadores y actividad reciente de donaciones y entregas.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { currentUser, donations, requests, users, entities } = useStore();
  if (!currentUser) return <AppShell title="Panel principal">{null}</AppShell>;

  const rol = currentUser.rol;
  const misDonaciones = donations.filter((d) => d.empresaId === currentUser.entidadId);
  const misSolicitudes = requests.filter((r) => r.orgId === currentUser.entidadId);
  const solicitudesRecibidas = requests.filter((r) => r.empresaId === currentUser.entidadId);

  const cards =
    rol === "admin"
      ? [
          { label: "Donaciones publicadas", value: donations.length, icon: Package },
          { label: "Solicitudes totales", value: requests.length, icon: ClipboardList },
          {
            label: "Entregas completadas",
            value: donations.filter((d) => d.estado === "Entregada").length,
            icon: PackageCheck,
          },
          { label: "Usuarios registrados", value: users.length, icon: Users },
          {
            label: "Empresas donantes",
            value: entities.filter((e) => e.tipo === "empresa").length,
            icon: Building2,
          },
          {
            label: "Organizaciones sociales",
            value: entities.filter((e) => e.tipo === "organizacion").length,
            icon: HandHeart,
          },
        ]
      : rol === "empresa"
        ? [
            { label: "Mis donaciones", value: misDonaciones.length, icon: Package },
            {
              label: "Disponibles",
              value: misDonaciones.filter((d) => d.estado === "Disponible").length,
              icon: PackageCheck,
            },
            {
              label: "Solicitudes por revisar",
              value: solicitudesRecibidas.filter((r) => r.estado === "Pendiente").length,
              icon: ClipboardList,
            },
            {
              label: "Entregas completadas",
              value: misDonaciones.filter((d) => d.estado === "Entregada").length,
              icon: Truck,
            },
          ]
        : [
            {
              label: "Donaciones disponibles",
              value: donations.filter((d) => d.estado === "Disponible").length,
              icon: Package,
            },
            { label: "Mis solicitudes", value: misSolicitudes.length, icon: ClipboardList },
            {
              label: "En camino",
              value: misSolicitudes.filter((r) => r.estado === "En camino").length,
              icon: Truck,
            },
            {
              label: "Recibidas",
              value: misSolicitudes.filter((r) => r.estado === "Entregada").length,
              icon: PackageCheck,
            },
          ];

  const actividad = [...donations]
    .flatMap((d) => d.historial.map((h) => ({ ...h, donacion: d.nombre, empresa: d.empresaNombre })))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 8);

  const relevantes =
    rol === "empresa" ? misDonaciones : rol === "organizacion" ? donations.filter((d) => d.estado === "Disponible") : donations;

  return (
    <AppShell
      title={`Hola, ${currentUser.nombre.split(" ")[0]}`}
      subtitle="Resumen de la actividad de la red de donaciones"
      actions={
        rol === "empresa" ? (
          <Button asChild>
            <Link to="/crear-donacion">Publicar donación</Link>
          </Button>
        ) : rol === "organizacion" ? (
          <Button asChild>
            <Link to="/donaciones">Ver donaciones</Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link to="/reportes">Ver reportes</Link>
          </Button>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <MetricCard key={c.label} label={c.label} value={c.value} icon={c.icon} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">
              {rol === "organizacion" ? "Donaciones disponibles" : "Donaciones recientes"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {relevantes.slice(0, 6).map((d) => (
              <Link
                key={d.id}
                to="/donaciones/$id"
                params={{ id: d.id }}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.empresaNombre} · {d.cantidad} {d.unidad} · {d.categoria}
                  </p>
                </div>
                <StatusBadge status={d.estado} />
              </Link>
            ))}
            {relevantes.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay donaciones registradas.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actividad.map((a, i) => (
              <div key={i} className="border-l-2 border-primary/30 pl-3">
                <p className="text-sm font-medium">{a.donacion}</p>
                <p className="text-xs text-muted-foreground">
                  {a.nota} · {a.fecha}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
