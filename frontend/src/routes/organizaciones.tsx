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
import { useStore } from "@/lib/store";

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
  const { entities, requests } = useStore();
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();

  const list = entities
    .filter((e) => e.tipo === "organizacion")
    .filter((e) => !term || `${e.nombre} ${e.giro} ${e.ciudad}`.toLowerCase().includes(term));

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
                const own = requests.filter((r) => r.orgId === e.id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{e.giro}</TableCell>
                    <TableCell>{e.ciudad}</TableCell>
                    <TableCell className="text-muted-foreground">{e.contacto}</TableCell>
                    <TableCell>{own.length}</TableCell>
                    <TableCell>{own.filter((r) => r.estado === "Entregada").length}</TableCell>
                    <TableCell>
                      <StatusBadge status={e.estatus} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No hay organizaciones que coincidan con la búsqueda.
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
