import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as authApi from "@/api/auth.api";
import { useAuth } from "@/hooks/useAuth";
import { TELEGRAM_BOT_ID } from "@/lib/constants";
import type { TelegramAuthData } from "@/types/auth";

// API exposée par https://telegram.org/js/telegram-widget.js
declare global {
  interface Window {
    Telegram?: {
      Login: {
        auth: (
          options: { bot_id: string; request_access?: string; lang?: string },
          callback: (user: TelegramAuthData | false) => void,
        ) => void;
      };
    };
  }
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#229ED9"
        d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-1.99 1.93c-.23.23-.42.42-.83.42z"
      />
    </svg>
  );
}

/**
 * Bouton « Se connecter avec Telegram » — TOUJOURS affiché, indépendamment de
 * la configuration. Au clic, ouvre la popup officielle Telegram
 * (window.Telegram.Login.auth), puis transmet les données signées au backend
 * qui vérifie le hash et ouvre la session.
 *
 * Config : VITE_TELEGRAM_BOT_ID (chiffres avant `:` dans le token du bot).
 * Pré-requis Telegram : `/setdomain` sur le bot avec le domaine du site
 * (le login ne fonctionne pas sur localhost).
 */
export function TelegramLogin({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charge le script Telegram une seule fois (pour disposer de Telegram.Login.auth).
  useEffect(() => {
    if (!TELEGRAM_BOT_ID || document.getElementById("telegram-widget-js")) return;
    const script = document.createElement("script");
    script.id = "telegram-widget-js";
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  function handleClick() {
    setError(null);

    if (!TELEGRAM_BOT_ID || !window.Telegram?.Login) {
      setError("Connexion Telegram non configurée (VITE_TELEGRAM_BOT_ID).");
      return;
    }

    setPending(true);
    window.Telegram.Login.auth(
      { bot_id: TELEGRAM_BOT_ID, request_access: "write" },
      (user) => {
        if (!user) {
          setPending(false); // popup fermée / refusée
          return;
        }
        authApi
          .loginTelegram(user)
          .then(() => refreshUser())
          .then(() => navigate("/app", { replace: true }))
          .catch(() => {
            setPending(false);
            setError("La connexion Telegram a échoué. Veuillez réessayer.");
          });
      },
    );
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin text-text-muted" />
        ) : (
          <>
            <TelegramIcon />
            Se connecter avec Telegram
          </>
        )}
      </Button>
      {error && <p className="mt-2 text-xs text-avoid">{error}</p>}
    </div>
  );
}
