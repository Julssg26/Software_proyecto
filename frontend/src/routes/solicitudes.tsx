import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/solicitudes")({
  head: () => ({
    meta: [
      { title: "Solicitudes de donación | DonaRed" },
      {
        name: "description",
        content: "Revisa, aprueba o rechaza las solicitudes de las organizaciones sociales.",
      },
      { property: "og:title", content: "Solicitudes de donación | DonaRed" },
      {
        property: "og:description",
        content: "Gestión de solicitudes recibidas por las empresas donantes.",
      },
    ],
  }),
  component: SolicitudesPage,
});

function SolicitudesPage() {
  const { requests, currentUser, approveRequest, rejectRequest } = useStore();
  const [q, setQ] = useState("");

  const base =
    currentUser?.rol === "admin"
      ? requests
      : requests.filter((r) => r.empresaId === currentUser?.entidadId);

  const list = base.filter(
    (r) =>
      !q.trim() ||
      `${r.donacionNombre} ${r.orgNombre}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <AppShell
      title="Solicitudes"
      subtitle={
        currentUser?.rol === "admin"
          ? "Todas las solicitudes de la plataforma"
          : "Solicitudes recibidas para tus donaciones"
      }
    >
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Buscar por donación u organización…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donación</TableHead>
                <TableHead>Organización</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.donacionNombre}</TableCell>
                  <TableCell>{r.orgNombre}</TableCell>
                  <TableCell className="max-w-72 text-sm text-muted-foreground">
                    {r.mensaje}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.fecha}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.estado} />
                  </TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    {r.estado === "Pendiente" && currentUser?.rol === "empresa" && (
                      <>
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await approveRequest(r.id);
                              toast.success("Solicitud aprobada");
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "No se pudo aprobar la solicitud",
                              );
                            }
                          }}
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await rejectRequest(r.id);
                              toast("Solicitud rechazada");
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "No se pudo rechazar la solicitud",
                              );
                            }
                          }}
                        >
                          Rechazar
                        </Button>
                      </>
                    )}
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/donaciones/$id" params={{ id: r.donacionId }}>
                        Ver donación
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No hay solicitudes que mostrar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
