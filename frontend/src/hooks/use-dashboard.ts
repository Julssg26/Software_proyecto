import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { dashboardApi, type DashboardData } from "@/services/dashboard";

// Mismo patrón que use-admin-list.ts: solo consulta cuando hay sesión lista,
// sin cache entre navegaciones (los números deben reflejar el estado actual).
export function useDashboard() {
  const { currentUser, hydrated } = useStore();
  const enabled = hydrated && !!currentUser;
  const query = useQuery<DashboardData>({
    queryKey: ["dashboard", currentUser?.id],
    queryFn: dashboardApi.get,
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  return {
    data: enabled && !query.isFetching && !query.isError ? (query.data ?? null) : null,
    loading: !hydrated || (enabled && query.isFetching),
  };
}
