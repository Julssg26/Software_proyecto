import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";

export function useAdminList<T>(resource: string, fetchList: () => Promise<T[]>) {
  const { currentUser, hydrated } = useStore();
  const allowed = hydrated && currentUser?.rol === "admin";
  const query = useQuery({
    queryKey: ["admin", resource, currentUser?.id],
    queryFn: fetchList,
    enabled: allowed,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  return {
    data: allowed && !query.isFetching && !query.isError ? (query.data ?? []) : [],
    loading: !hydrated || (allowed && query.isFetching),
    error:
      hydrated && currentUser && !allowed
        ? "No tienes permisos para consultar esta información."
        : (query.error?.message ?? null),
  };
}
