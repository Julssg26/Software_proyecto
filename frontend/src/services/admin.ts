import { api } from "./api";
import type { ApiEntity, ApiUser } from "./auth";

export interface AdminUser extends ApiUser {
  createdAt: string;
  updatedAt: string;
  entity: Pick<ApiEntity, "_id" | "name" | "type" | "email" | "phone" | "status"> | null;
}
export type AdminEntity = Omit<ApiEntity, "type">;

export const adminApi = {
  users: () => api<{ users: AdminUser[] }>("/admin/users").then((result) => result.users),
  companies: () =>
    api<{ entities: AdminEntity[] }>("/admin/entities/companies").then((result) => result.entities),
  organizations: () =>
    api<{ entities: AdminEntity[] }>("/admin/entities/organizations").then(
      (result) => result.entities,
    ),
};
