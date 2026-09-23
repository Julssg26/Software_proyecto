import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { useAdminList } from "@/hooks/use-admin-list";
import { adminApi } from "@/services/admin";
import { ROLE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Gestión de usuarios | DonaRed" },
      {
        name: "description",
        content: "Administra las cuentas de empresas, organizaciones y administradores de la red.",
      },
      { property: "og:title", content: "Gestión de usuarios | DonaRed" },
      {
        property: "og:description",
        content: "Consulta las cuentas y los roles asignados.",
      },
    ],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const { data: users, loading, error } = useAdminList("users", adminApi.users);
  const [q, setQ] = useState("");

  const list = users.filter(
    (u) =>
      !q.trim() ||
      `${u.name} ${u.email} ${u.entity?.name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <AppShell title="Usuarios" subtitle="Cuentas registradas en la plataforma">
      <Card>
        <CardContent className="p-4">
          <Input
            className="max-w-sm"
            placeholder="Buscar por nombre, correo o entidad…"
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
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {loading ? "Cargando usuarios…" : error ?? "No hay usuarios que coincidan con la búsqueda."}
                  </TableCell>
                </TableRow>
              )}
              {list.map((u) => (
                <TableRow key={u._id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                  <TableCell className="text-muted-foreground">{u.entity?.name ?? "Sin entidad"}</TableCell>
                  <TableCell>
                    <StatusBadge status={u.status === "active" ? "Activo" : "Inactivo"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      title="Solo consulta: la edición administrativa no está disponible"
                    >
                      {u.status === "active" ? "Desactivar" : "Activar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
