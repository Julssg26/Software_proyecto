import { api } from "./api";
import type { DonationStatus, RequestStatus } from "../lib/types";

export interface AdminDashboard {
  role: "admin";
  totalDonations: number;
  totalDelivered: number;
  activeRequests: number;
  totalCompanies: number;
  totalOrganizations: number;
  activeUsers: number;
}

export interface CompanyDashboard {
  role: "empresa";
  donationsByStatus: Record<DonationStatus, number>;
  pendingReceivedRequests: number;
}

export interface OrganizationDashboard {
  role: "organizacion";
  totalAvailableDonations: number;
  requestsByStatus: Record<Extract<RequestStatus, "Pendiente" | "Aprobada" | "Rechazada">, number>;
  pendingDeliveries: number;
}

export type DashboardData = AdminDashboard | CompanyDashboard | OrganizationDashboard;

export const dashboardApi = {
  get: () => api<DashboardData>("/dashboard"),
};
