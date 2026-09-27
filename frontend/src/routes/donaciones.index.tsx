import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { CATEGORIES, DONATION_STATUSES } from "@/lib/types";

export const Route = createFileRoute("/donaciones/")({
  head: () => ({
    meta: [
      { title: "Donaciones disponibles | DonaRed" },
      {
        name: "description",
        content:
          "Catálogo de alimentos y recursos publicados por empresas donantes, con filtros por categoría y estado.",
      },
      { property: "og:title", content: "Donaciones disponibles | DonaRed" },
      {
        property: "og:description",
        content: "Explora y solicita los recursos publicados por las empresas donantes.",
      },
    ],
  }),
  component: DonacionesPage,
});

function DonacionesPage() {
  const { donations, currentUser } = useStore();
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [estado, setEstado] = useState(
    currentUser?.rol === "organizacion" ? "Disponible" : "todos",
  );

  const filtered = useMemo(
    () =>
      donations.filter((d) => {
        const matchQ =
          !q.trim() ||
          `${d.nombre} ${d.descripcion} ${d.empresaNombre}`
            .toLowerCase()
            .includes(q.trim().toLowerCase());
        const matchCat = categoria === "todas" || d.categoria === categoria;
        const matchEstado = estado === "todos" || d.estado === estado;
        return matchQ && matchCat && matchEstado;
      }),
    [donations, q, categoria, estado],
  );

  return (
    <AppShell title="Donaciones" subtitle="Recursos publicados por las empresas donantes de la red">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por recurso o empresa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {DONATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((d) => (
          <Card key={d.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold leading-tight">{d.nombre}</h2>
                <StatusBadge status={d.estado} />
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{d.descripcion}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt className="font-medium text-foreground">Cantidad</dt>
                  <dd>
                    {d.cantidad} {d.unidad}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Categoría</dt>
                  <dd>{d.categoria}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Empresa</dt>
                  <dd>{d.empresaNombre}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Vigencia</dt>
                  <dd>{d.vigencia || "Sin fecha"}</dd>
                </div>
              </dl>
              <Button asChild variant="outline" className="mt-auto w-full">
                <Link to="/donaciones/$id" params={{ id: d.id }}>
                  Ver detalle
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No hay donaciones que coincidan con los filtros seleccionados.
        </p>
      )}
    </AppShell>
  );
}
