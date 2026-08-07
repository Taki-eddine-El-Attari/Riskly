import { API_BASE_URL } from "./constants";

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

// Un item d'erreur de validation Pydantic/FastAPI, ex. celui renvoyé dans le
// tableau `detail` d'une réponse 422 :
// { "loc": ["body", "entite"], "msg": "Input should be 'CMH1', 'CMH2', ...", "type": "literal_error" }
interface PydanticValidationError {
  loc?: unknown[];
  msg?: unknown;
}

function isPydanticValidationError(value: unknown): value is PydanticValidationError {
  return typeof value === "object" && value !== null && "msg" in value;
}

// FastAPI renvoie `detail` comme une simple chaîne pour les erreurs métier
// (ex. HTTPException(detail="...")), mais comme un tableau d'objets pour les
// erreurs de validation Pydantic (422). Sans cette extraction, `new Error(detail)`
// convertit silencieusement ce tableau en la chaîne "[object Object]".
function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const detail = (body as { detail?: unknown }).detail;

    if (typeof detail === "string") return detail;

    if (Array.isArray(detail) && detail.length > 0) {
      const messages = detail
        .filter(isPydanticValidationError)
        .map((item) => {
          const field = Array.isArray(item.loc)
            ? item.loc.filter((part) => part !== "body").join(".")
            : undefined;
          const msg = typeof item.msg === "string" ? item.msg : undefined;
          if (!msg) return undefined;
          return field ? `${field} : ${msg}` : msg;
        })
        .filter((msg): msg is string => !!msg);
      if (messages.length > 0) return messages.join(" ");
    }

    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
        message = extractErrorMessage(body, message);
      } catch {
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
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
