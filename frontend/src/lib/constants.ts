
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const TELEGRAM_BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID ?? "";

export const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT ?? "";

export const MAX_DOMAINS = 5;

export const MAX_CSV_IMPORT_DOMAINS = 50;

export const BULK_ANALYSIS_CONCURRENCY = 4;

export const ANALYSIS_BUDGET_MS = 15_000;

export const LOADER_SEQUENCE_MS = 5_000;

export const SOURCES = [
  "RDAP",
  "Résolution DNS",
  "Blacklists DNS",
  "Open PageRank",
  "Bases de menaces",
  "ip-api",
] as const;
