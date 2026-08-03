
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const TELEGRAM_BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID ?? "";

/** Nom du bot Telegram (sans @) — informatif / docs. */
export const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT ?? "";

/** Limite de domaines par analyse (PRD : quotas des sources gratuites). */
export const MAX_DOMAINS = 5;

/** Budget de temps annoncé pour un domaine non mis en cache (PRD §3.1). */
export const ANALYSIS_BUDGET_MS = 15_000;

/** Durée de la séquence de collecte affichée par l'AnalysisLoader. */
export const LOADER_SEQUENCE_MS = 5_000;

/** Les sources interrogées, dans l'ordre où l'AnalysisLoader les affiche. */
export const SOURCES = [
  "RDAP",
  "Résolution DNS",
  "Blacklists DNS",
  "Open PageRank",
  "Bases de menaces",
  "ip-api",
] as const;
