import { apiClient } from "@/lib/api-client";
import type { AuthResponse, TelegramAuthData, User } from "@/types/auth";

/**
 * Envoie les données du Login Widget Telegram au backend.
 * Le backend vérifie le `hash`, crée/retrouve le compte via l'`id` Telegram,
 * pose le cookie de session HttpOnly, puis renvoie l'utilisateur.
 */
export function loginTelegram(data: TelegramAuthData): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>("/api/v1/auth/telegram", data);
}

/** Récupère l'utilisateur de la session courante (via le cookie). 401 si absent. */
export function getCurrentUser(): Promise<User> {
  return apiClient.get<User>("/api/v1/auth/me");
}

/** Détruit la session côté serveur et efface le cookie. */
export function logout(): Promise<void> {
  return apiClient.post<void>("/api/v1/auth/logout");
}
