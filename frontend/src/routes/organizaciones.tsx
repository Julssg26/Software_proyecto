import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
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
import { useAdminList } from "@/hooks/use-admin-list";
import { adminApi } from "@/services/admin";

export const Route = createFileRoute("/organizaciones")({
  head: () => ({
    meta: [
      { title: "Organizaciones sociales | DonaRed" },
      {
        name: "description",
        content: "Directorio de organizaciones sociales beneficiarias, su ciudad y solicitudes realizadas.",
      },
      { property: "og:title", content: "Organizaciones sociales | DonaRed" },
      {
        property: "og:description",
        content: "Revisa el estatus de verificación de cada organización beneficiaria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrganizacionesPage,
});

function OrganizacionesPage() {
  const { data: entities, loading, error } = useAdminList("organizations", adminApi.organizations);
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();

  const list = entities
    .filter((e) => !term || `${e.name} ${e.description ?? ""} ${e.address?.city ?? ""}`.toLowerCase().includes(term));

  return (
    <AppShell title="Organizaciones" subtitle="Organizaciones sociales beneficiarias">
      <Card>
        <CardContent className="p-4">
          <Input
            className="max-w-sm"
            placeholder="Buscar por nombre, giro o ciudad…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organización</TableHead>
                <TableHead>Actividad</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Solicitudes</TableHead>
                <TableHead>Recibidas</TableHead>
                <TableHead>Estatus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((e) => {
                return (
                  <TableRow key={e._id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.description || "—"}</TableCell>
                    <TableCell>{e.address?.city || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.email || e.phone || "—"}</TableCell>
                    <TableCell><span title="Conteo no disponible en este módulo">—</span></TableCell>
                    <TableCell><span title="Conteo no disponible en este módulo">—</span></TableCell>
                    <TableCell>
                      <StatusBadge status={e.status === "active" ? "Activo" : "Inactivo"} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {loading ? "Cargando organizaciones…" : error ?? "No hay organizaciones que coincidan con la búsqueda."}
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
