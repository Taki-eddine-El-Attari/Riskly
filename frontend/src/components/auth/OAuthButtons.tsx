import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function OAuthButtons({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  function handleClick() {
    setPending(true);
    // ponytail: connexion Telegram simulée, brancher le login widget Telegram quand le backend existera
    setTimeout(() => navigate("/app"), 800);
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
    </div>
  );
}
