import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Package, Truck, ClipboardCheck, Percent, Clock, Award } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { CATEGORIES, DONATION_STATUSES } from "@/lib/types";
import { useReportSummary } from "@/hooks/use-reports";

export const Route = createFileRoute("/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes e indicadores | DonaRed" },
      {
        name: "description",
        content:
          "Indicadores de donaciones publicadas, entregas completadas y distribución por categoría.",
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

function formatHours(hours: number | null): string {
  if (hours === null) return "Sin datos";
  if (hours < 24) return `${hours} h`;
  return `${Math.round((hours / 24) * 10) / 10} días`;
}

function ReportesPage() {
  const { currentUser, donations } = useStore();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const {
    data: summary,
    loading,
    error,
  } = useReportSummary({ from: from || undefined, to: to || undefined });

  // La distribución por categoría/estado ya usa `donations`, que el store llena
  // con datos reales filtrados por rol (backend); no depende de reports/summary.
  const mine =
    currentUser?.rol === "empresa"
      ? donations.filter((d) => d.empresaId === currentUser.entidadId)
      : donations;

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

  const dash = (value: number | undefined) => (loading || value === undefined ? "…" : value);

  const topCards =
    summary?.role === "admin"
      ? [
          {
            label: "Donaciones publicadas",
            value: dash(summary.donationsPublished),
            icon: Package,
          },
          { label: "Entregas completadas", value: dash(summary.donationsDelivered), icon: Truck },
          {
            label: "Tasa de rechazo",
            value: loading ? "…" : `${summary.rejectionRate}%`,
            icon: Percent,
          },
          {
            label: "Tiempo prom. de aprobación",
            value: loading ? "…" : formatHours(summary.avgApprovalHours),
            icon: Clock,
          },
        ]
      : summary?.role === "empresa"
        ? [
            {
              label: "Donaciones publicadas",
              value: dash(summary.donationsPublished),
              icon: Package,
            },
            { label: "Entregas completadas", value: dash(summary.donationsDelivered), icon: Truck },
            {
              label: "Tasa de rechazo",
              value: loading ? "…" : `${summary.rejectionRate}%`,
              icon: Percent,
            },
            {
              label: "Tiempo prom. de entrega",
              value: loading ? "…" : formatHours(summary.avgDeliveryHours),
              icon: Clock,
            },
          ]
        : summary?.role === "organizacion"
          ? [
              {
                label: "Solicitudes enviadas",
                value: dash(summary.requestsSent),
                icon: ClipboardCheck,
              },
              {
                label: "Solicitudes aprobadas",
                value: dash(summary.requestsApproved),
                icon: Package,
              },
              {
                label: "Tasa de rechazo",
                value: loading ? "…" : `${summary.rejectionRate}%`,
                icon: Percent,
              },
              {
                label: "Tiempo prom. de aprobación",
                value: loading ? "…" : formatHours(summary.avgApprovalHours),
                icon: Clock,
              },
            ]
          : [];

  return (
    <AppShell title="Reportes" subtitle="Indicadores de impacto de la red de donaciones">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="report-from">Desde</Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-to">Hasta</Label>
            <Input id="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <Button
              variant="outline"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Limpiar filtro
            </Button>
          )}
          <p className="ml-auto text-xs text-muted-foreground">
            Sin fechas se muestra todo el histórico.
          </p>
        </CardContent>
      </Card>

      {error && (
        <p className="mt-4 text-sm text-destructive">No se pudieron cargar los reportes: {error}</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {topCards.map((c) => (
          <MetricCard key={c.label} label={c.label} value={c.value} icon={c.icon} />
        ))}
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

      {summary?.role === "admin" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top categorías donadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary.topCategories.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin datos en el rango seleccionado.</p>
              )}
              {summary.topCategories.map((c) => (
                <Bar
                  key={c.category}
                  label={c.category}
                  value={c.count}
                  max={Math.max(1, ...summary.topCategories.map((x) => x.count))}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="size-4" /> Top organizaciones receptoras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary.topOrganizations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sin entregas confirmadas en el rango seleccionado.
                </p>
              )}
              {summary.topOrganizations.map((o) => (
                <Bar
                  key={o.organizationId}
                  label={o.name ?? "Organización eliminada"}
                  value={o.count}
                  max={Math.max(1, ...summary.topOrganizations.map((x) => x.count))}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
