import { api } from "./api";
import type { DonationStatus } from "../lib/types";

export type DeliveryStatus = "Preparando" | "En camino" | "Entregada" | "Incidencia";

export interface ApiDeliveryDonationSummary {
  _id: string;
  title: string;
  category: string;
  quantity: number;
  unit: string;
  status: DonationStatus;
  companyId: string;
  companyName: string | null;
}

export interface ApiDeliveryRequestSummary {
  _id: string;
  organizationId: string;
  organizationName: string | null;
}

export interface ApiDelivery {
  _id: string;
  status: DeliveryStatus;
  sentAt?: string | null;
  receivedAt?: string | null;
  incident?: { hasIncident: boolean; description?: string };
  donationId: ApiDeliveryDonationSummary;
  requestId: ApiDeliveryRequestSummary;
}

export const deliveriesApi = {
  listMine: () => api<{ deliveries: ApiDelivery[] }>("/deliveries/my"),
  ship: (id: string) =>
    api<{ delivery: ApiDelivery }>(`/deliveries/${id}/ship`, { method: "PATCH" }),
  receive: (id: string) =>
    api<{ delivery: ApiDelivery }>(`/deliveries/${id}/receive`, { method: "PATCH" }),
  reportIncident: (id: string, description: string) =>
    api<{ delivery: ApiDelivery }>(`/deliveries/${id}/incident`, {
      method: "PATCH",
      body: { description },
    }),
};
