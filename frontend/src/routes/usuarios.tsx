import { createFileRoute } from "@tanstack/react-router";
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
        content: "Activa o desactiva cuentas y consulta los roles asignados.",
      },
    ],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const { users, toggleUserStatus } = useStore();
  const [q, setQ] = useState("");

  const list = users.filter(
    (u) =>
      !q.trim() ||
      `${u.nombre} ${u.correo} ${u.entidad}`.toLowerCase().includes(q.trim().toLowerCase()),
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
              {list.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{u.correo}</TableCell>
                  <TableCell>{ROLE_LABEL[u.rol]}</TableCell>
                  <TableCell className="text-muted-foreground">{u.entidad}</TableCell>
                  <TableCell>
                    <StatusBadge status={u.estado} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toggleUserStatus(u.id);
                        toast.success("Estado de la cuenta actualizado");
                      }}
                    >
                      {u.estado === "Activo" ? "Desactivar" : "Activar"}
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
