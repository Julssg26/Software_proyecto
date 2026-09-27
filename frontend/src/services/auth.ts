import { api } from "./api";
import type { Role, User } from "../lib/types";

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  entityId: string | null;
  status: "active" | "inactive";
}
export interface ApiEntity {
  _id: string;
  name: string;
  type: "empresa" | "organizacion";
  description?: string;
  email?: string;
  phone?: string;
  address?: { street?: string; city?: string; state?: string; postalCode?: string };
  status: "active" | "inactive";
  createdAt: string;
}
export type EntityInput = Pick<ApiEntity, "name"> &
  Partial<Pick<ApiEntity, "description" | "email" | "phone" | "address">>;
export interface AuthResponse {
  token: string;
  user: ApiUser;
}
export type PublicRole = Exclude<Role, "admin">;

export const authApi = {
  login: (email: string, password: string) =>
    api<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      authenticated: false,
    }),
  register: (body: { name: string; email: string; password: string; role: PublicRole }) => {
    if (body.role !== "empresa" && body.role !== "organizacion") {
      return Promise.reject(new Error("Solo se permite registrar empresas u organizaciones"));
    }
    return api<AuthResponse>("/auth/register", { method: "POST", body, authenticated: false });
  },
  profile: () => api<{ user: ApiUser }>("/auth/profile"),
  entity: () => api<{ entity: ApiEntity }>("/entities/me"),
  createEntity: (body: EntityInput) =>
    api<{ entity: ApiEntity }>("/entities", { method: "POST", body }),
  updateEntity: (body: Partial<EntityInput>) =>
    api<{ entity: ApiEntity }>("/entities/me", { method: "PUT", body }),
};

export function toUser(user: ApiUser, entity: ApiEntity | null): User {
  return {
    id: user._id,
    nombre: user.name,
    correo: user.email,
    rol: user.role,
    entidad:
      entity?.name ??
      (user.role === "admin"
        ? "DonaRed"
        : user.entityId
          ? "Entidad no disponible"
          : "Sin entidad registrada"),
    entidadId: user.entityId ?? "",
    estado: user.status === "active" ? "Activo" : "Inactivo",
  };
}

// Los tres roles ya tienen un dashboard que adapta contenido y navegación al rol real.
export const roleHome: Record<Role, "/dashboard"> = {
  admin: "/dashboard",
  empresa: "/dashboard",
  organizacion: "/dashboard",
};
