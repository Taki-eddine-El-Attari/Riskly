import { useEffect, useRef } from "react";
import {
  TELEGRAM_BOT_USERNAME,
  TELEGRAM_CALLBACK_PATH,
} from "@/lib/constants";

/**
 * Bouton officiel « Log in with Telegram ».
 *
 * On charge le widget officiel de Telegram en mode `data-auth-url` :
 * après autorisation dans l'app Telegram, le navigateur est redirigé vers
 * TELEGRAM_CALLBACK_PATH avec les données signées en query string. La page
 * TelegramCallback les transmet au backend, qui vérifie le `hash` et pose
 * le cookie de session HttpOnly.
 *
 * Pré-requis (une seule fois) :
 *   1. Créer un bot via @BotFather → récupérer le token (côté backend).
 *   2. `/setdomain` sur le bot avec le domaine exact du site.
 *   3. Renseigner VITE_TELEGRAM_BOT (nom du bot, sans @) dans le .env du front.
 *
 * Le widget ne fonctionne pas sur `localhost` : utiliser un domaine déclaré
 * (ou un tunnel type ngrok) pour tester en local.
 */
export function TelegramLogin({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !TELEGRAM_BOT_USERNAME) return;

    const authUrl = `${window.location.origin}${TELEGRAM_CALLBACK_PATH}`;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-auth-url", authUrl);

    container.appendChild(script);
    return () => {
      container.innerHTML = "";
    };
  }, []);

  if (!TELEGRAM_BOT_USERNAME) {
    return (
      <div className={className}>
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-center text-xs text-text-muted">
          Connexion Telegram non configurée — renseignez{" "}
          <code className="font-mono">VITE_TELEGRAM_BOT</code>.
        </p>
      </div>
    );
  }

  // Le widget injecte son propre bouton (iframe) dans ce conteneur.
  return <div ref={containerRef} className={className} />;
}
