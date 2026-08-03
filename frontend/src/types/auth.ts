
export type Role = "superadmin" | "admin" | "user";
export type AuthMethod = "local" | "telegram";

export interface User {
  id: string;
  username: string;
  telegram_id: number | null;
  telegram_username: string | null;
  photo_url: string | null;
  role: Role;
  auth_method: AuthMethod;
  entite: string | null;
  created_at: string | null;
}

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}
