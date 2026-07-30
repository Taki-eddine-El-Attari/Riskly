import { API_BASE_URL } from "./constants";

/**
 * Instance HTTP minimale (fetch).
 * - baseURL centralisée
 * - `credentials: "include"` : le cookie de session HttpOnly voyage avec chaque requête
 * - timeout 90 s (les analyses peuvent être longues)
 * - AUCUNE injection de token : la session est portée par le cookie, pas par le JS
 */

const TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Sur un corps multipart, seul le navigateur peut poser le Content-Type :
  // il doit y ajouter la frontière (boundary) qu'il vient de générer.
  const isMultipart = init.body instanceof FormData;

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      signal: controller.signal,
      headers: {
        ...(isMultipart ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });

    if (!res.ok) {
      let message = res.statusText;
      try {
        const body = await res.json();
        message = body.detail ?? body.message ?? message;
      } catch {
        /* corps non-JSON : on garde le statusText */
      }
      throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "La requête a expiré.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  /** POST multipart — pour les requêtes qui portent un fichier. */
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
