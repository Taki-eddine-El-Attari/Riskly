// Miroir des schemas Pydantic backend (app/schemas/user.py → UserRead).

export type Role = "superadmin" | "admin" | "user";
export type AuthMethod = "local" | "telegram";

export interface User {
  id: string;
  /** Handle applicatif, unique (dérivé du handle Telegram pour un compte Telegram). */
  username: string;
  /** Identifiant Telegram permanent — présent seulement pour un compte Telegram. */
  telegram_id: number | null;
  telegram_username: string | null;
  photo_url: string | null;
  role: Role;
  auth_method: AuthMethod;
  entite: string | null;
  created_at: string | null;
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
