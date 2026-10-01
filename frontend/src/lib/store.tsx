import { useAuthSession } from "../hooks/use-auth-session";
import type { ApiEntity } from "../services/auth";
import { donationsApi, toDonation } from "../services/donations";
import { requestsApi, toDonationRequest, type ApiRequest } from "../services/requests";
import { deliveriesApi } from "../services/deliveries";
import { notificationsApi, toNotification } from "../services/notifications";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { seedEntities, seedUsers } from "./mock-data";
import type { AppNotification, Donation, DonationRequest, Entity, User } from "./types";

interface State {
  users: User[];
  entities: Entity[];
  donations: Donation[];
  requests: DonationRequest[];
  notifications: AppNotification[];
}

const initialState: State = {
  users: seedUsers,
  entities: seedEntities,
  donations: [],
  requests: [],
  notifications: [],
};

export interface NewDonationInput {
  nombre: string;
  descripcion: string;
  categoria: Donation["categoria"];
  cantidad: number;
  unidad: string;
  vigencia: string;
  observaciones: string;
}

interface StoreValue extends State {
  hydrated: boolean;
  currentUser: User | null;
  currentEntity: ApiEntity | null;
  refreshProfile: () => Promise<void>;
  updateEntity: ReturnType<typeof useAuthSession>["updateEntity"];
  login: ReturnType<typeof useAuthSession>["login"];
  logout: () => void;
  register: ReturnType<typeof useAuthSession>["register"];
  donationsLoading: boolean;
  refreshDonations: () => Promise<void>;
  createDonation: (input: NewDonationInput) => Promise<void>;
  updateDonation: (id: string, input: NewDonationInput) => Promise<void>;
  deleteDonation: (id: string) => Promise<void>;
  requestDonation: (donationId: string, mensaje: string) => Promise<void>;
  approveRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  markShipped: (donationId: string) => Promise<void>;
  confirmReceipt: (donationId: string) => Promise<void>;
  reportIncident: (requestId: string, detalle: string) => Promise<void>;
  toggleUserStatus: (userId: string) => void;
  unreadNotifications: number;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [donationsLoading, setDonationsLoading] = useState(false);
  const {
    currentUser,
    currentEntity,
    sessionReady,
    login,
    register,
    logout,
    refreshProfile,
    updateEntity,
  } = useAuthSession();

  // Notificaciones (módulo 4) todavía no tiene backend propio. Donaciones y
  // Solicitudes ya vienen siempre del servidor (ver refreshDonations/refreshRequests).
  useEffect(() => {
    setHydrated(true);
  }, []);

  const refreshDonations = useCallback(async () => {
    if (!currentUser) {
      setState((s) => ({ ...s, donations: [] }));
      return;
    }
    setDonationsLoading(true);
    try {
      const { donations } = await donationsApi.list();
      setState((s) => ({ ...s, donations: donations.map(toDonation) }));
    } catch (error) {
      console.error("No se pudieron cargar las donaciones", error);
    } finally {
      setDonationsLoading(false);
    }
  }, [currentUser]);

  const refreshRequests = useCallback(async () => {
    if (!currentUser) {
      setState((s) => ({ ...s, requests: [] }));
      return;
    }
    try {
      let requests: ApiRequest[] = [];
      if (currentUser.rol === "organizacion") {
        ({ requests } = await requestsApi.listMine());
      } else if (currentUser.rol === "empresa" || currentUser.rol === "admin") {
        ({ requests } = await requestsApi.listReceived());
      }

      // GET /deliveries/my ya filtra por rol en el backend (empresa: las suyas;
      // organización: las suyas; admin: todas), igual que /requests.
      const { deliveries } = await deliveriesApi.listMine();
      const deliveryByRequestId = new Map(deliveries.map((d) => [d.requestId._id, d]));

      setState((s) => ({
        ...s,
        requests: requests.map((r) => {
          const mapped = toDonationRequest(r);
          const delivery = deliveryByRequestId.get(r._id);
          if (!delivery) return mapped;
          // "Preparando" (justo tras aprobar, antes de enviar) se sigue mostrando
          // como "Aprobada"; el resto de estados de Delivery sí son visibles.
          const estado = delivery.status === "Preparando" ? mapped.estado : delivery.status;
          const incidencia = delivery.incident?.hasIncident
            ? delivery.incident.description
            : mapped.incidencia;
          return {
            ...mapped,
            entregaId: delivery._id,
            estado,
            ...(incidencia !== undefined ? { incidencia } : {}),
          };
        }),
      }));
    } catch (error) {
      console.error("No se pudieron cargar las solicitudes", error);
    }
  }, [currentUser]);

  const refreshNotifications = useCallback(async () => {
    if (!currentUser) {
      setState((s) => ({ ...s, notifications: [] }));
      return;
    }
    try {
      const { notifications } = await notificationsApi.listMine();
      setState((s) => ({ ...s, notifications: notifications.map(toNotification) }));
    } catch (error) {
      console.error("No se pudieron cargar las notificaciones", error);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!sessionReady) return;
    void refreshDonations();
    void refreshRequests();
    void refreshNotifications();
    // Cambia qué donaciones/solicitudes/notificaciones ve el usuario según su rol,
    // así que se recarga en cada login/logout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, currentUser?.id]);

  // Refresco ligero para que la campana de notificaciones no dependa de que el
  // usuario navegue a otra vista; no hay backend con websockets todavía.
  useEffect(() => {
    if (!sessionReady || !currentUser) return;
    const interval = setInterval(() => void refreshNotifications(), 30_000);
    return () => clearInterval(interval);
  }, [sessionReady, currentUser, refreshNotifications]);

  // requestDonation/approveRequest/rejectRequest llaman al backend real y luego
  // resincronizan requests+donations, porque aprobar puede rechazar automáticamente
  // otras solicitudes sobre la misma donación (efecto colateral del servidor).
  const requestDonation = useCallback(
    async (donationId: string, mensaje: string) => {
      await requestsApi.create({ donationId, message: mensaje });
      await Promise.all([refreshRequests(), refreshDonations()]);
    },
    [refreshRequests, refreshDonations],
  );

  const approveRequest = useCallback(
    async (requestId: string) => {
      await requestsApi.approve(requestId);
      // Aprobar puede rechazar automáticamente otras solicitudes pendientes sobre la
      // misma donación (regla de negocio del backend): por eso se recarga la lista
      // completa en vez de parchear solo la solicitud tocada.
      await Promise.all([refreshRequests(), refreshDonations()]);
    },
    [refreshRequests, refreshDonations],
  );

  const rejectRequest = useCallback(
    async (requestId: string) => {
      await requestsApi.reject(requestId);
      await Promise.all([refreshRequests(), refreshDonations()]);
    },
    [refreshRequests, refreshDonations],
  );

  const toApiInput = (input: NewDonationInput) => ({
    title: input.nombre,
    description: input.descripcion,
    category: input.categoria,
    quantity: input.cantidad,
    unit: input.unidad,
    expirationDate: input.vigencia ? input.vigencia : null,
    observations: input.observaciones,
  });

  const createDonation = useCallback(async (input: NewDonationInput) => {
    const { donation } = await donationsApi.create(toApiInput(input));
    setState((s) => ({ ...s, donations: [toDonation(donation), ...s.donations] }));
  }, []);

  const updateDonation = useCallback(async (id: string, input: NewDonationInput) => {
    const { donation } = await donationsApi.update(id, toApiInput(input));
    setState((s) => ({
      ...s,
      donations: s.donations.map((d) => (d.id === id ? toDonation(donation) : d)),
    }));
  }, []);

  const deleteDonation = useCallback(async (id: string) => {
    await donationsApi.remove(id);
    setState((s) => ({
      ...s,
      donations: s.donations.filter((d) => d.id !== id),
      requests: s.requests.filter((r) => r.donacionId !== id),
    }));
  }, []);

  // markShipped/confirmReceipt/reportIncident reciben donationId/requestId (igual que
  // antes) porque así los llaman los componentes; aquí se resuelve el entregaId
  // correspondiente a partir de requests (ya fusionado con su Delivery en refreshRequests)
  // y se llama al endpoint real. Tras cada acción se resincroniza todo desde el servidor.
  const markShipped = useCallback(
    async (donationId: string) => {
      const req = state.requests.find(
        (r) => r.donacionId === donationId && r.estado === "Aprobada",
      );
      if (!req?.entregaId) throw new Error("No se encontró la entrega asociada a esta donación");
      await deliveriesApi.ship(req.entregaId);
      await Promise.all([refreshRequests(), refreshDonations()]);
    },
    [state.requests, refreshRequests, refreshDonations],
  );

  const confirmReceipt = useCallback(
    async (donationId: string) => {
      const req = state.requests.find(
        (r) => r.donacionId === donationId && ["En camino", "Aprobada"].includes(r.estado),
      );
      if (!req?.entregaId) throw new Error("No se encontró la entrega asociada a esta donación");
      await deliveriesApi.receive(req.entregaId);
      await Promise.all([refreshRequests(), refreshDonations()]);
    },
    [state.requests, refreshRequests, refreshDonations],
  );

  const reportIncident = useCallback(
    async (requestId: string, detalle: string) => {
      const req = state.requests.find((r) => r.id === requestId);
      if (!req?.entregaId) throw new Error("No se encontró la entrega asociada a esta solicitud");
      await deliveriesApi.reportIncident(req.entregaId, detalle);
      await Promise.all([refreshRequests(), refreshDonations()]);
    },
    [state.requests, refreshRequests, refreshDonations],
  );

  const toggleUserStatus = useCallback((userId: string) => {
    setState((s) => ({
      ...s,
      users: s.users.map((u) =>
        u.id === userId ? { ...u, estado: u.estado === "Activo" ? "Inactivo" : "Activo" } : u,
      ),
    }));
  }, []);

  const markNotificationRead = useCallback(
    async (id: string) => {
      // Optimista: se actualiza localmente primero para que el clic se sienta
      // inmediato, y si el backend falla se revierte con un refetch real.
      setState((s) => ({
        ...s,
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
      try {
        await notificationsApi.markRead(id);
      } catch (error) {
        console.error("No se pudo marcar la notificación como leída", error);
        await refreshNotifications();
      }
    },
    [refreshNotifications],
  );

  const markAllNotificationsRead = useCallback(async () => {
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    try {
      await notificationsApi.markAllRead();
    } catch (error) {
      console.error("No se pudieron marcar las notificaciones como leídas", error);
      await refreshNotifications();
    }
  }, [refreshNotifications]);

  const value: StoreValue = {
    ...state,
    hydrated: hydrated && sessionReady,
    currentUser,
    login,
    currentEntity,
    refreshProfile,
    updateEntity,
    logout,
    register,
    donationsLoading,
    refreshDonations,
    createDonation,
    updateDonation,
    deleteDonation,
    requestDonation,
    approveRequest,
    rejectRequest,
    markShipped,
    confirmReceipt,
    reportIncident,
    toggleUserStatus,
    unreadNotifications: state.notifications.filter((n) => !n.read).length,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de StoreProvider");
  return ctx;
}
