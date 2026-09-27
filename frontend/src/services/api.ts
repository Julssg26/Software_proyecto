// En desarrollo apunta al backend local; en staging/producción se define
// VITE_API_URL en el entorno de build (ver frontend/.env.example).
export const baseURL = import.meta.env["VITE_API_URL"] || "http://localhost:3000/api";
const TOKEN_KEY = "donared-auth-token";
export const SESSION_EXPIRED = "donared-session-expired";

export const getToken = () =>
  typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
export const saveToken = (token: string) => window.localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => window.localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    authenticated?: boolean;
  } = {},
): Promise<T> {
  const token = options.authenticated === false ? null : getToken();
  let response: Response;
  try {
    response = await fetch(`${baseURL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError("Error de conexión con el servidor", 0);
  }
  if (response.status === 401 && token && getToken() === token) {
    clearToken();
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    const message =
      response.status === 401 && path === "/auth/login"
        ? "Credenciales incorrectas"
        : response.status === 409 && path === "/auth/register"
          ? "Email ya registrado"
          : (data?.message ?? `Error del servidor (${response.status})`);
    throw new ApiError(message, response.status);
  }
  if (data === null) {
    if (response.status === 204) return undefined as T;
    throw new ApiError("El servidor devolvió una respuesta inválida", response.status);
  }
  return data as T;
}
