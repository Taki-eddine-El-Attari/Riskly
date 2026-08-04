import { apiClient } from "@/lib/api-client";
import type { TelegramAuthData, User } from "@/types/auth";

export function loginTelegram(data: TelegramAuthData): Promise<User> {
  return apiClient.post<User>("/api/v1/auth/telegram", data);
}

export function register(name: string, password: string, entite?: string): Promise<User> {
  return apiClient.post<User>("/api/v1/auth/register", { name, password, entite });
}

export function login(name: string, password: string): Promise<User> {
  return apiClient.post<User>("/api/v1/auth/login", { name, password });
}

export function getCurrentUser(): Promise<User> {
  return apiClient.get<User>("/api/v1/auth/me");
}

export function logout(): Promise<void> {
  return apiClient.post<void>("/api/v1/auth/logout");
}
