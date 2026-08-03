import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as authApi from "@/api/auth.api";
import { useAuth } from "@/hooks/useAuth";
import { TELEGRAM_BOT_ID } from "@/lib/constants";
import type { TelegramAuthData } from "@/types/auth";

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

export function TelegramLogin({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    setSuccess(null);

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
          .then((account) => {
            const handle = account.telegram_username ?? account.username;
            setSuccess(`Connecté en tant que @${handle}`);
            return refreshUser();
          })
          .then(() => {
            // Laisse le message de confirmation visible un instant.
            setTimeout(() => navigate("/app", { replace: true }), 1400);
          })
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
        {pending && !success ? (
          <div className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin text-text-muted" />
            <span className="text-sm">Connexion en cours…</span>
          </div>
        ) : (
          <>
            <TelegramIcon />
            Se connecter avec Telegram
          </>
        )}
      </Button>

      {success && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-good">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {success}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-avoid">{error}</p>}
    </div>
  );
}
