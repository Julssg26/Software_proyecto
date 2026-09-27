import { api } from "./api";
import type { Category, Donation, DonationStatus } from "../lib/types";

export interface ApiHistoryEntry {
  status: DonationStatus;
  date: string;
  note?: string;
}

export interface ApiDonation {
  _id: string;
  title: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
  observations?: string;
  companyId: string;
  companyName: string | null;
  status: DonationStatus;
  history: ApiHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface DonationInput {
  title: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
  observations?: string;
}

export const donationsApi = {
  list: () => api<{ donations: ApiDonation[] }>("/donations"),
  get: (id: string) => api<{ donation: ApiDonation }>(`/donations/${id}`),
  create: (body: DonationInput) =>
    api<{ donation: ApiDonation }>("/donations", { method: "POST", body }),
  update: (id: string, body: Partial<DonationInput>) =>
    api<{ donation: ApiDonation }>(`/donations/${id}`, { method: "PUT", body }),
  remove: (id: string) => api<void>(`/donations/${id}`, { method: "DELETE" }),
};

// Traduce la forma del backend (inglés, companyId/companyName) a la forma
// que ya consume toda la UI existente (español, empresaId/empresaNombre).
export function toDonation(d: ApiDonation): Donation {
  return {
    id: d._id,
    nombre: d.title,
    descripcion: d.description,
    categoria: d.category as Category,
    cantidad: d.quantity,
    unidad: d.unit,
    vigencia: d.expirationDate ? d.expirationDate.slice(0, 10) : "",
    observaciones: d.observations ?? "",
    empresaId: d.companyId,
    empresaNombre: d.companyName ?? "Empresa",
    fecha: d.createdAt ? d.createdAt.slice(0, 10) : "",
    estado: d.status,
    historial: (d.history ?? []).map((h) => ({
      estado: h.status,
      fecha: h.date ? h.date.slice(0, 10) : "",
      nota: h.note ?? "",
    })),
  };
}
