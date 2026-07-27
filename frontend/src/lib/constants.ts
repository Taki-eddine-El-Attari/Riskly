// Constantes transversales, zéro logique métier.

/** Base de l'API backend. Surchargeable via VITE_API_URL. */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Identifiant NUMÉRIQUE du bot Telegram (les chiffres avant `:` dans le token,
 *  non secret). Requis pour ouvrir la popup de login. Vide = login désactivé
 *  (le bouton reste affiché mais inactif). */
export const TELEGRAM_BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID ?? "";

/** Nom du bot Telegram (sans @) — informatif / docs. */
export const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT ?? "";

/** Limite de domaines par analyse. */
export const MAX_DOMAINS = 5;
