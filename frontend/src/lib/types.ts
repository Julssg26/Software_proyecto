export type Role = "admin" | "empresa" | "organizacion";

export type DonationStatus =
  | "Disponible"
  | "Solicitada"
  | "Aprobada"
  | "En camino"
  | "Entregada"
  | "Rechazada";

export type RequestStatus =
  | "Pendiente"
  | "Aprobada"
  | "Rechazada"
  | "En camino"
  | "Entregada"
  | "Incidencia";

export type Category =
  | "Alimentos frescos"
  | "Alimentos no perecederos"
  | "Bebidas"
  | "Higiene"
  | "Ropa"
  | "Mobiliario"
  | "Insumos escolares";

export const CATEGORIES: Category[] = [
  "Alimentos frescos",
  "Alimentos no perecederos",
  "Bebidas",
  "Higiene",
  "Ropa",
  "Mobiliario",
  "Insumos escolares",
];

export const DONATION_STATUSES: DonationStatus[] = [
  "Disponible",
  "Solicitada",
  "Aprobada",
  "En camino",
  "Entregada",
  "Rechazada",
];

export interface HistoryEntry {
  estado: DonationStatus | RequestStatus;
  fecha: string;
  nota: string;
}

export interface Donation {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: Category;
  cantidad: number;
  unidad: string;
  vigencia: string;
  observaciones: string;
  empresaId: string;
  empresaNombre: string;
  fecha: string;
  estado: DonationStatus;
  historial: HistoryEntry[];
}

export interface DonationRequest {
  id: string;
  donacionId: string;
  donacionNombre: string;
  orgId: string;
  orgNombre: string;
  empresaId: string;
  empresaNombre: string;
  mensaje: string;
  fecha: string;
  estado: RequestStatus;
  incidencia?: string;
}

export interface User {
  id: string;
  nombre: string;
  correo: string;
  rol: Role;
  entidad: string;
  entidadId: string;
  estado: "Activo" | "Inactivo";
  password?: string;
}

export interface Entity {
  id: string;
  nombre: string;
  tipo: "empresa" | "organizacion";
  giro: string;
  ciudad: string;
  contacto: string;
  estatus: "Verificada" | "En revisión" | "Suspendida";
  desde: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  empresa: "Empresa donante",
  organizacion: "Organización social",
};
