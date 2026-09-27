import { api } from "./api";
import type { Category, DonationRequest, DonationStatus, RequestStatus } from "../lib/types";

export interface ApiDonationSummary {
  _id: string;
  title: string;
  category: string;
  quantity: number;
  unit: string;
  status: DonationStatus;
  companyId: string;
  companyName: string | null;
}

export interface ApiEntitySummary {
  _id: string;
  name: string;
  status: string;
}

export interface ApiRequest {
  _id: string;
  donationId: ApiDonationSummary;
  organizationId: ApiEntitySummary;
  message?: string;
  status: RequestStatus;
  requestedAt: string;
  reviewedAt?: string | null;
}

export interface ApiDelivery {
  _id: string;
  requestId: string;
  donationId: string;
  status: string;
}

export const requestsApi = {
  create: (body: { donationId: string; message?: string }) =>
    api<{ request: ApiRequest }>("/requests", { method: "POST", body }),
  listMine: () => api<{ requests: ApiRequest[] }>("/requests/my"),
  listReceived: () => api<{ requests: ApiRequest[] }>("/requests/received"),
  approve: (id: string) =>
    api<{ request: ApiRequest; delivery: ApiDelivery }>(`/requests/${id}/approve`, {
      method: "PATCH",
    }),
  reject: (id: string) =>
    api<{ request: ApiRequest }>(`/requests/${id}/reject`, { method: "PATCH" }),
};

// El backend separa Request (Pendiente/Aprobada/Rechazada) de Delivery
// (Preparando/En camino/Entregada/Incidencia); el tipo DonationRequest del
// frontend todavía junta ambos conceptos en un solo `estado`, porque el
// módulo de Entregas aún no está conectado. Por ahora esto solo traduce el
// estado de la Request; "En camino"/"Entregada"/"Incidencia" los sigue
// gestionando el store de forma local hasta construir /api/deliveries.
export function toDonationRequest(r: ApiRequest): DonationRequest {
  return {
    id: r._id,
    donacionId: r.donationId._id,
    donacionNombre: r.donationId.title,
    orgId: r.organizationId._id,
    orgNombre: r.organizationId.name,
    empresaId: r.donationId.companyId,
    empresaNombre: r.donationId.companyName ?? "Empresa",
    mensaje: r.message ?? "",
    fecha: r.requestedAt ? r.requestedAt.slice(0, 10) : "",
    estado: r.status,
  };
}

export type { Category };
