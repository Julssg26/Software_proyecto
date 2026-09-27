import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { reportsApi, type ReportFilters, type ReportSummary } from "@/services/reports";

// Mismo patrón que use-dashboard.ts / use-admin-list.ts. Los filtros de fecha
// forman parte de la queryKey para que cambiar el rango dispare un refetch.
export function useReportSummary(filters: ReportFilters) {
  const { currentUser, hydrated } = useStore();
  const enabled = hydrated && !!currentUser;
  const query = useQuery<ReportSummary>({
    queryKey: ["reports-summary", currentUser?.id, filters.from ?? null, filters.to ?? null],
    queryFn: () => reportsApi.summary(filters),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return {
    data: enabled && !query.isFetching && !query.isError ? (query.data ?? null) : null,
    loading: !hydrated || (enabled && query.isFetching),
    error: query.isError ? (query.error as Error).message : null,
  };
}
