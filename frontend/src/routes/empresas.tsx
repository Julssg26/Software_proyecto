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

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas donantes | DonaRed" },
      {
        name: "description",
        content: "Consulta las empresas donantes registradas, su giro, ciudad y estatus de verificación.",
      },
      { property: "og:title", content: "Empresas donantes | DonaRed" },
      {
        property: "og:description",
        content: "Directorio de empresas donantes de la red y sus donaciones publicadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmpresasPage,
});

function EmpresasPage() {
  const { data: entities, loading, error } = useAdminList("companies", adminApi.companies);
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();

  const list = entities
    .filter((e) => !term || `${e.name} ${e.description ?? ""} ${e.address?.city ?? ""}`.toLowerCase().includes(term));

  return (
    <AppShell title="Empresas" subtitle="Empresas donantes registradas en la red">
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
                <TableHead>Empresa</TableHead>
                <TableHead>Giro</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Donaciones</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead>Desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((e) => (
                <TableRow key={e._id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-muted-foreground">{e.description || "—"}</TableCell>
                  <TableCell>{e.address?.city || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.email || e.phone || "—"}</TableCell>
                  <TableCell><span title="Conteo no disponible en este módulo">—</span></TableCell>
                  <TableCell>
                    <StatusBadge status={e.status === "active" ? "Activo" : "Inactivo"} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.createdAt?.slice(0, 10) ?? "—"}</TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {loading ? "Cargando empresas…" : error ?? "No hay empresas que coincidan con la búsqueda."}
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
