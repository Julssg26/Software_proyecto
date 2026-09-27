import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil | DonaRed" },
      {
        name: "description",
        content:
          "Consulta los datos de tu cuenta, tu entidad y el resumen de tu actividad en la red.",
      },
      { property: "og:title", content: "Mi perfil | DonaRed" },
      {
        property: "og:description",
        content: "Datos de contacto de tu entidad y resumen de donaciones o solicitudes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerfilPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function PerfilPage() {
  const {
    currentUser,
    currentEntity: entity,
    donations,
    requests,
    refreshProfile,
    hydrated,
  } = useStore();
  useEffect(() => {
    if (hydrated)
      void refreshProfile().catch((error) =>
        toast.error(error instanceof Error ? error.message : "No se pudo cargar el perfil"),
      );
  }, [hydrated, refreshProfile]);
  if (!currentUser) return <AppShell title="Perfil">{null}</AppShell>;
  const esEmpresa = currentUser.rol === "empresa";
  const misDonaciones = donations.filter((d) => d.empresaId === currentUser.entidadId);
  const misSolicitudes = requests.filter((r) =>
    esEmpresa ? r.empresaId === currentUser.entidadId : r.orgId === currentUser.entidadId,
  );

  return (
    <AppShell title="Perfil" subtitle="Datos de tu cuenta y de tu entidad">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuenta</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row label="Nombre" value={currentUser.nombre} />
            <Row label="Correo" value={currentUser.correo} />
            <Row label="Rol" value={ROLE_LABEL[currentUser.rol]} />
            <Row label="Estado" value={<StatusBadge status={currentUser.estado} />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entidad</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row label="Nombre" value={currentUser.entidad} />
            <Row label="Actividad" value={entity?.description || "Por definir"} />
            <Row label="Ciudad" value={entity?.address?.city || "Por definir"} />
            <Row label="Contacto" value={entity?.email || entity?.phone || currentUser.correo} />
            <Row
              label="Estado"
              value={
                entity ? (
                  <StatusBadge status={entity.status === "active" ? "Activo" : "Inactivo"} />
                ) : (
                  "Sin registro"
                )
              }
            />
            <Row label="Miembro desde" value={entity?.createdAt?.slice(0, 10) ?? "—"} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-base">Resumen de actividad</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              {esEmpresa ? "Donaciones publicadas" : "Solicitudes enviadas"}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {esEmpresa ? misDonaciones.length : misSolicitudes.length}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Entregas completadas</p>
            <p className="mt-1 text-2xl font-semibold">
              {misSolicitudes.filter((r) => r.estado === "Entregada").length}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">En proceso</p>
            <p className="mt-1 text-2xl font-semibold">
              {
                misSolicitudes.filter((r) =>
                  ["Pendiente", "Aprobada", "En camino"].includes(r.estado),
                ).length
              }
            </p>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
