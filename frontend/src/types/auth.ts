// Miroir des schemas Pydantic backend (voir backend/auth.py).

export type Role = "user" | "admin" | "super_admin";

export interface User {
  id: string;
  /** Identifiant Telegram permanent (la vraie clé du compte). */
  telegramId: number;
  /** @username Telegram — public, sert uniquement à l'affichage, jamais de clé. */
  username: string | null;
  displayName: string;
  photoUrl: string | null;
  role: Role;
  entity: string | null;
}

/**
 * Données brutes renvoyées par le Login Widget Telegram.
 * Transmises telles quelles au backend, qui vérifie le `hash`
 * avant de faire confiance à quoi que ce soit.
 */
export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Réponse de tout endpoint d'authentification : uniquement l'utilisateur,
 *  jamais de token — la session vit dans un cookie HttpOnly. */
export interface AuthResponse {
  user: User;
}
