import { apiClient } from "@/lib/api-client";
import type { TelegramAuthData, User } from "@/types/auth";

/**
 * Login/register via le Login Widget Telegram.
 * Le backend vérifie le `hash`, crée/retrouve le compte via l'`id` Telegram,
 * ouvre la session (cookie HttpOnly), puis renvoie l'utilisateur.
 */
export function loginTelegram(data: TelegramAuthData): Promise<User> {
  return apiClient.post<User>("/api/v1/auth/telegram", data);
}

/** Inscription locale (username + mot de passe). */
export function register(name: string, password: string): Promise<User> {
  return apiClient.post<User>("/api/v1/auth/register", { name, password });
}

/** Connexion locale (username + mot de passe). Ouvre la session. */
export function login(name: string, password: string): Promise<User> {
  return apiClient.post<User>("/api/v1/auth/login", { name, password });
}

/** Récupère l'utilisateur de la session courante (via le cookie). 401 si absent. */
export function getCurrentUser(): Promise<User> {
  return apiClient.get<User>("/api/v1/auth/me");
}

/** Détruit la session côté serveur et efface le cookie. */
export function logout(): Promise<void> {
  return apiClient.post<void>("/api/v1/auth/logout");
}
