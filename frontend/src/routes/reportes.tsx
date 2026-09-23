import { createFileRoute } from "@tanstack/react-router";
import { Package, Truck, ClipboardCheck, Percent } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { CATEGORIES, DONATION_STATUSES } from "@/lib/types";
import { monthlyStats } from "@/lib/mock-data";

export const Route = createFileRoute("/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes e indicadores | DonaRed" },
      {
        name: "description",
        content: "Indicadores de donaciones publicadas, entregas completadas y distribución por categoría.",
      },
      { property: "og:title", content: "Reportes e indicadores | DonaRed" },
      {
        property: "og:description",
        content: "Visualiza el desempeño mensual de la red de donaciones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportesPage,
});

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="font-medium text-muted-foreground">{value}</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full rounded-full bg-muted">
        <div className="h-2.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ReportesPage() {
  const { currentUser, donations, requests } = useStore();

  const mine =
    currentUser?.rol === "empresa"
      ? donations.filter((d) => d.empresaId === currentUser.entidadId)
      : donations;
  const myRequests =
    currentUser?.rol === "empresa"
      ? requests.filter((r) => r.empresaId === currentUser.entidadId)
      : requests;

  const entregadas = mine.filter((d) => d.estado === "Entregada").length;
  const tasa = mine.length ? Math.round((entregadas / mine.length) * 100) : 0;
  const unidades = mine.reduce((sum, d) => sum + d.cantidad, 0);

  const byCategory = CATEGORIES.map((c) => ({
    label: c,
    value: mine.filter((d) => d.categoria === c).length,
  })).filter((c) => c.value > 0);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.value));

  const byStatus = DONATION_STATUSES.map((s) => ({
    label: s,
    value: mine.filter((d) => d.estado === s).length,
  }));
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.value));
  const maxMonth = Math.max(...monthlyStats.map((m) => Math.max(m.donaciones, m.entregas)));

  return (
    <AppShell title="Reportes" subtitle="Indicadores de impacto de la red de donaciones">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Donaciones publicadas" value={mine.length} icon={Package} />
        <MetricCard label="Entregas completadas" value={entregadas} icon={Truck} />
        <MetricCard label="Solicitudes recibidas" value={myRequests.length} icon={ClipboardCheck} />
        <MetricCard
          label="Tasa de entrega"
          value={`${tasa}%`}
          hint={`${unidades} unidades gestionadas`}
          icon={Percent}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Donaciones por categoría</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {byCategory.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay donaciones registradas.</p>
            )}
            {byCategory.map((c) => (
              <Bar key={c.label} label={c.label} value={c.value} max={maxCat} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Donaciones por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {byStatus.map((s) => (
              <Bar key={s.label} label={s.label} value={s.value} max={maxStatus} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-base">Evolución mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 overflow-x-auto pb-2">
            {monthlyStats.map((m) => (
              <div key={m.mes} className="flex min-w-14 flex-1 flex-col items-center gap-2">
                <div className="flex h-40 items-end gap-1.5">
                  <div
                    className="w-5 rounded-t-md bg-primary"
                    style={{ height: `${(m.donaciones / maxMonth) * 100}%` }}
                    title={`${m.donaciones} donaciones`}
                  />
                  <div
                    className="w-5 rounded-t-md bg-accent"
                    style={{ height: `${(m.entregas / maxMonth) * 100}%` }}
                    title={`${m.entregas} entregas`}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{m.mes}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-sm bg-primary" /> Donaciones publicadas
            </span>
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-sm bg-accent" /> Entregas completadas
            </span>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
