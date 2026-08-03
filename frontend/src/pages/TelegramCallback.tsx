import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import * as authApi from "@/api/auth.api";
import { useAuth } from "@/hooks/useAuth";
import type { TelegramAuthData } from "@/types/auth";

export default function TelegramCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false); 

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const id = params.get("id");
    const hash = params.get("hash");
    const authDate = params.get("auth_date");

    if (!id || !hash || !authDate) {
      setError("Données Telegram manquantes ou invalides.");
      return;
    }

    const payload: TelegramAuthData = {
      id: Number(id),
      first_name: params.get("first_name") ?? "",
      last_name: params.get("last_name") ?? undefined,
      username: params.get("username") ?? undefined,
      photo_url: params.get("photo_url") ?? undefined,
      auth_date: Number(authDate),
      hash,
    };

    authApi
      .loginTelegram(payload)
      .then(() => refreshUser())
      .then(() => navigate("/app", { replace: true }))
      .catch(() => setError("La connexion Telegram a échoué. Veuillez réessayer."));
  }, [params, navigate, refreshUser]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-avoid">{error}</p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="text-sm text-accent transition-colors hover:underline"
          >
            Retour à la connexion
          </button>
        </>
      ) : (
        <>
          <Loader2 className="size-6 animate-spin text-accent" />
          <p className="text-sm text-text-muted">Connexion en cours…</p>
        </>
      )}
    </main>
  );
}
