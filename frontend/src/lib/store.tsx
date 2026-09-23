import { useAuthSession } from "../hooks/use-auth-session";
import type { ApiEntity } from "../services/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  seedDonations,
  seedEntities,
  seedRequests,
  seedUsers,
} from "./mock-data";
import type {
  Donation,
  DonationRequest,
  DonationStatus,
  Entity,
  User,
} from "./types";

const STORAGE_KEY = "donared-demo-state-v1";

interface State {
  users: User[];
  entities: Entity[];
  donations: Donation[];
  requests: DonationRequest[];
}

const initialState: State = {
  users: seedUsers,
  entities: seedEntities,
  donations: seedDonations,
  requests: seedRequests,
};

const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}`;

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
  login: ReturnType<typeof useAuthSession>["login"];
  logout: () => void;
  register: ReturnType<typeof useAuthSession>["register"];
  createDonation: (input: NewDonationInput) => void;
  updateDonation: (id: string, input: NewDonationInput) => void;
  deleteDonation: (id: string) => void;
  requestDonation: (donationId: string, mensaje: string) => void;
  approveRequest: (requestId: string) => void;
  rejectRequest: (requestId: string, motivo?: string) => void;
  markShipped: (donationId: string) => void;
  confirmReceipt: (donationId: string) => void;
  reportIncident: (requestId: string, detalle: string) => void;
  toggleUserStatus: (userId: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const { currentUser, currentEntity, sessionReady, login, register, logout, refreshProfile } = useAuthSession();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<State>;
        setState({
          ...initialState,
          donations: saved.donations ?? initialState.donations,
          requests: saved.requests ?? initialState.requests,
        });
      }
    } catch {
      /* demo local, ignora errores de lectura */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ donations: state.donations, requests: state.requests }));
    } catch {
      /* ignora errores de escritura */
    }
  }, [state, hydrated]);

  const setDonationStatus = useCallback(
    (id: string, estado: DonationStatus, nota: string) => {
      setState((s) => ({
        ...s,
        donations: s.donations.map((d) =>
          d.id === id
            ? {
                ...d,
                estado,
                historial: [...d.historial, { estado, fecha: today(), nota }],
              }
            : d,
        ),
      }));
    },
    [],
  );

  const createDonation = useCallback(
    (input: NewDonationInput) => {
      if (!currentUser) return;
      const donation: Donation = {
        ...input,
        id: uid("d"),
        empresaId: currentUser.entidadId,
        empresaNombre: currentUser.entidad,
        fecha: today(),
        estado: "Disponible",
        historial: [{ estado: "Disponible", fecha: today(), nota: "Donación publicada" }],
      };
      setState((s) => ({ ...s, donations: [donation, ...s.donations] }));
    },
    [currentUser],
  );

  const updateDonation = useCallback((id: string, input: NewDonationInput) => {
    setState((s) => ({
      ...s,
      donations: s.donations.map((d) =>
        d.id === id
          ? {
              ...d,
              ...input,
              historial: [
                ...d.historial,
                { estado: d.estado, fecha: today(), nota: "Información de la donación actualizada" },
              ],
            }
          : d,
      ),
    }));
  }, []);

  const deleteDonation = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      donations: s.donations.filter((d) => d.id !== id),
      requests: s.requests.filter((r) => r.donacionId !== id),
    }));
  }, []);

  const requestDonation = useCallback(
    (donationId: string, mensaje: string) => {
      if (!currentUser) return;
      const donation = state.donations.find((d) => d.id === donationId);
      if (!donation) return;
      const request: DonationRequest = {
        id: uid("r"),
        donacionId: donation.id,
        donacionNombre: donation.nombre,
        orgId: currentUser.entidadId,
        orgNombre: currentUser.entidad,
        empresaId: donation.empresaId,
        empresaNombre: donation.empresaNombre,
        mensaje,
        fecha: today(),
        estado: "Pendiente",
      };
      setState((s) => ({ ...s, requests: [request, ...s.requests] }));
      setDonationStatus(donationId, "Solicitada", `Solicitada por ${currentUser.entidad}`);
    },
    [currentUser, state.donations, setDonationStatus],
  );

  const setRequestStatus = useCallback(
    (requestId: string, estado: DonationRequest["estado"], extra?: Partial<DonationRequest>) => {
      setState((s) => ({
        ...s,
        requests: s.requests.map((r) => (r.id === requestId ? { ...r, estado, ...extra } : r)),
      }));
    },
    [],
  );

  const approveRequest = useCallback(
    (requestId: string) => {
      const req = state.requests.find((r) => r.id === requestId);
      if (!req) return;
      setRequestStatus(requestId, "Aprobada");
      setDonationStatus(req.donacionId, "Aprobada", `Solicitud de ${req.orgNombre} aprobada`);
    },
    [state.requests, setRequestStatus, setDonationStatus],
  );

  const rejectRequest = useCallback(
    (requestId: string, motivo?: string) => {
      const req = state.requests.find((r) => r.id === requestId);
      if (!req) return;
      setRequestStatus(requestId, "Rechazada");
      setDonationStatus(
        req.donacionId,
        "Rechazada",
        motivo?.trim() ? `Solicitud rechazada: ${motivo}` : `Solicitud de ${req.orgNombre} rechazada`,
      );
    },
    [state.requests, setRequestStatus, setDonationStatus],
  );

  const markShipped = useCallback(
    (donationId: string) => {
      const req = state.requests.find(
        (r) => r.donacionId === donationId && r.estado === "Aprobada",
      );
      if (req) setRequestStatus(req.id, "En camino");
      setDonationStatus(donationId, "En camino", "La empresa marcó la donación como enviada");
    },
    [state.requests, setRequestStatus, setDonationStatus],
  );

  const confirmReceipt = useCallback(
    (donationId: string) => {
      const req = state.requests.find(
        (r) => r.donacionId === donationId && ["En camino", "Aprobada"].includes(r.estado),
      );
      if (req) setRequestStatus(req.id, "Entregada");
      setDonationStatus(donationId, "Entregada", "Recepción confirmada por la organización");
    },
    [state.requests, setRequestStatus, setDonationStatus],
  );

  const reportIncident = useCallback(
    (requestId: string, detalle: string) => {
      setRequestStatus(requestId, "Incidencia", { incidencia: detalle });
      const req = state.requests.find((r) => r.id === requestId);
      if (req) setDonationStatus(req.donacionId, req.estado === "Entregada" ? "Entregada" : "Aprobada", `Incidencia reportada: ${detalle}`);
    },
    [state.requests, setRequestStatus, setDonationStatus],
  );

  const toggleUserStatus = useCallback((userId: string) => {
    setState((s) => ({
      ...s,
      users: s.users.map((u) =>
        u.id === userId ? { ...u, estado: u.estado === "Activo" ? "Inactivo" : "Activo" } : u,
      ),
    }));
  }, []);

  const value: StoreValue = {
    ...state,
    hydrated: hydrated && sessionReady,
    currentUser,
    login,
    currentEntity,
    refreshProfile,
    logout,
    register,
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
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de StoreProvider");
  return ctx;
}
