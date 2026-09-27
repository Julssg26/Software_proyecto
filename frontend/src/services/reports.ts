import { api } from "./api";
import type { Category } from "../lib/types";

export interface AdminReportSummary {
  role: "admin";
  from: string | null;
  to: string | null;
  donationsPublished: number;
  donationsDelivered: number;
  rejectionRate: number;
  avgApprovalHours: number | null;
  avgDeliveryHours: number | null;
  topCategories: { category: Category | string; count: number }[];
  topOrganizations: { organizationId: string; name: string | null; count: number }[];
}

export interface CompanyReportSummary {
  role: "empresa";
  from: string | null;
  to: string | null;
  donationsPublished: number;
  donationsDelivered: number;
  rejectionRate: number;
  avgApprovalHours: number | null;
  avgDeliveryHours: number | null;
}

export interface OrganizationReportSummary {
  role: "organizacion";
  from: string | null;
  to: string | null;
  requestsSent: number;
  requestsApproved: number;
  requestsRejected: number;
  rejectionRate: number;
  avgApprovalHours: number | null;
  avgDeliveryHours: number | null;
}

export type ReportSummary = AdminReportSummary | CompanyReportSummary | OrganizationReportSummary;

export interface ReportFilters {
  from?: string | undefined;
  to?: string | undefined;
}

function toQueryString(filters: ReportFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const reportsApi = {
  summary: (filters: ReportFilters = {}) =>
    api<ReportSummary>(`/reports/summary${toQueryString(filters)}`),
};
