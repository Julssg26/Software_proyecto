import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError, clearToken, getToken, saveToken, SESSION_EXPIRED } from "../services/api";
import {
  authApi,
  toUser,
  type ApiEntity,
  type ApiUser,
  type PublicRole,
  type EntityInput,
} from "../services/auth";
import type { User } from "../lib/types";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la operación";
export interface RegistrationInput {
  nombre: string;
  correo: string;
  password: string;
  rol: PublicRole;
  entidad: string;
}

export function useAuthSession() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentEntity, setCurrentEntity] = useState<ApiEntity | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const pendingRegistration = useRef<ApiUser | null>(null);
  const generation = useRef(0);
  const entityRevision = useRef(0);

  const logout = useCallback(() => {
    generation.current++;
    clearToken();
    pendingRegistration.current = null;
    setCurrentUser(null);
    setCurrentEntity(null);
  }, []);

  const loadUser = useCallback(async (user: ApiUser, token: string) => {
    if (getToken() !== token) return;
    const revision = entityRevision.current;
    let entity: ApiEntity | null = null;
    if (user.role !== "admin") {
      try {
        entity = (await authApi.entity()).entity;
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) throw error;
        if (!(error instanceof ApiError && error.status === 404)) toast.error(errorMessage(error));
      }
    }
    if (getToken() !== token) return;
    if (revision !== entityRevision.current) return;
    setCurrentEntity(entity);
    setCurrentUser(toUser(user, entity));
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const { user } = await authApi.profile();
    await loadUser(user, token);
  }, [loadUser]);

  const updateEntity = useCallback(
    async (input: EntityInput) => {
      const token = getToken();
      const attempt = generation.current;
      if (
        !token ||
        !currentUser ||
        !currentEntity ||
        currentUser.entidadId !== currentEntity._id ||
        !["empresa", "organizacion"].includes(currentUser.rol)
      ) {
        throw new Error("No hay una entidad disponible para editar.");
      }
      // Invalida cargas anteriores para que no sobrescriban la respuesta del PUT.
      entityRevision.current++;
      const { entity } = await authApi.updateEntity(input);
      if (getToken() !== token || generation.current !== attempt) {
        throw new Error("La sesión cambió. Inicia sesión nuevamente.");
      }
      entityRevision.current++;
      setCurrentEntity(entity);
      setCurrentUser((user) =>
        user?.id === currentUser.id ? { ...user, entidad: entity.name } : user,
      );
    },
    [currentUser, currentEntity],
  );

  useEffect(() => {
    const expire = () => {
      logout();
      toast.error("Tu sesión expiró. Inicia sesión nuevamente.");
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "donared-auth-token" || event.key === null) {
        setCurrentUser(null);
        setCurrentEntity(null);
        void refreshProfile().catch((error) => toast.error(errorMessage(error)));
      }
    };
    window.addEventListener(SESSION_EXPIRED, expire);
    window.addEventListener("storage", storage);
    void refreshProfile()
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => setSessionReady(true));
    return () => {
      window.removeEventListener(SESSION_EXPIRED, expire);
      window.removeEventListener("storage", storage);
    };
  }, [logout, refreshProfile]);

  const login = useCallback(
    async (correo: string, password: string) => {
      const attempt = ++generation.current;
      try {
        const { user, token } = await authApi.login(correo, password);
        if (attempt !== generation.current) return { ok: false, error: "Operación cancelada" };
        saveToken(token);
        pendingRegistration.current = null;
        await loadUser(user, token);
        if (attempt !== generation.current || getToken() !== token)
          return { ok: false, error: "Operación cancelada" };
        return { ok: true, role: user.role };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    },
    [loadUser],
  );

  const register = useCallback(
    async (input: RegistrationInput) => {
      const attempt = ++generation.current;
      let registered = false;
      try {
        let user = pendingRegistration.current;
        if (!user || user.email !== input.correo.trim().toLowerCase() || !getToken()) {
          const result = await authApi.register({
            name: input.nombre,
            email: input.correo,
            password: input.password,
            role: input.rol,
          });
          if (attempt !== generation.current) return { ok: false, error: "Operación cancelada" };
          saveToken(result.token);
          user = result.user;
          pendingRegistration.current = user;
        }
        registered = true;
        if (user.role !== "admin") {
          try {
            const { entity } = await authApi.createEntity({
              name: input.entidad,
              email: user.email,
            });
            user = { ...user, entityId: entity._id };
          } catch (error) {
            // Un reintento tras perder la respuesta puede encontrar la entidad ya creada.
            if (!(error instanceof ApiError && error.status === 409)) throw error;
          }
        }
        if (attempt !== generation.current) return { ok: false, error: "Operación cancelada" };
        await refreshProfile();
        if (attempt !== generation.current || !getToken())
          return { ok: false, error: "Operación cancelada" };
        pendingRegistration.current = null;
        return { ok: true, role: user.role };
      } catch (error) {
        return {
          ok: false,
          error: registered
            ? `La cuenta ya fue creada. No se pudo completar su entidad: ${errorMessage(error)}. Reintenta con los mismos datos.`
            : errorMessage(error),
        };
      }
    },
    [refreshProfile],
  );

  return {
    currentUser,
    currentEntity,
    sessionReady,
    login,
    register,
    logout,
    refreshProfile,
    updateEntity,
  };
}
