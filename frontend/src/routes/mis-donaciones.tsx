import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { DonationForm } from "@/components/donation-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/mis-donaciones")({
  head: () => ({
    meta: [
      { title: "Mis donaciones | DonaRed" },
      {
        name: "description",
        content: "Administra las donaciones publicadas por tu empresa: edita, elimina y da seguimiento.",
      },
      { property: "og:title", content: "Mis donaciones | DonaRed" },
      {
        property: "og:description",
        content: "Gestiona las donaciones publicadas por tu empresa donante.",
      },
    ],
  }),
  component: MisDonacionesPage,
});

function MisDonacionesPage() {
  const { donations, currentUser, updateDonation, deleteDonation, markShipped } = useStore();
  const [editId, setEditId] = useState<string | null>(null);

  const mias = donations.filter((d) => d.empresaId === currentUser?.entidadId);
  const editing = mias.find((d) => d.id === editId);

  return (
    <AppShell
      title="Mis donaciones"
      subtitle="Donaciones publicadas por tu empresa"
      actions={
        <Button asChild>
          <Link to="/crear-donacion">Publicar donación</Link>
        </Button>
      }
    >
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recurso</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mias.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{d.categoria}</TableCell>
                  <TableCell>
                    {d.cantidad} {d.unidad}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.vigencia || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.estado} />
                  </TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/donaciones/$id" params={{ id: d.id }}>
                        Ver
                      </Link>
                    </Button>
                    {d.estado === "Aprobada" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          markShipped(d.id);
                          toast.success("Donación marcada como enviada");
                        }}
                      >
                        Enviar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEditId(d.id)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        deleteDonation(d.id);
                        toast("Donación eliminada");
                      }}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {mias.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Aún no has publicado donaciones.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar donación</DialogTitle>
          </DialogHeader>
          {editing && (
            <DonationForm
              submitLabel="Guardar cambios"
              initial={{
                nombre: editing.nombre,
                descripcion: editing.descripcion,
                categoria: editing.categoria,
                cantidad: editing.cantidad,
                unidad: editing.unidad,
                vigencia: editing.vigencia,
                observaciones: editing.observaciones,
              }}
              onSubmit={(input) => {
                updateDonation(editing.id, input);
                toast.success("Donación actualizada");
                setEditId(null);
              }}
              onCancel={() => setEditId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
