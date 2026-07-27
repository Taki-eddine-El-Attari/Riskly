// Constantes transversales, zéro logique métier.

/** Base de l'API backend. Surchargeable via VITE_API_URL. */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Nom du bot Telegram (sans @) utilisé par le Login Widget.
 *  À créer via @BotFather, puis `/setdomain` sur le domaine du site. */
export const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT ?? "";

/** Route frontend vers laquelle Telegram redirige après autorisation. */
export const TELEGRAM_CALLBACK_PATH = "/telegram/callback";

/** Limite de domaines par analyse. */
export const MAX_DOMAINS = 5;
