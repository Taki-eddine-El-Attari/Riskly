import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Bouton de bascule clair / sombre.
 * Affiche l'icône de la CIBLE (soleil en sombre → « passer au clair »,
 * lune en clair → « passer au sombre »). Icônes en fondu-croisé.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Activer le thème sombre" : "Activer le thème clair"}
      title={isLight ? "Thème sombre" : "Thème clair"}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-lg text-text-muted outline-none transition-colors hover:bg-bg-elevated hover:text-text focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/30 motion-reduce:transition-none",
        className
      )}
    >
      <Sun
        aria-hidden
        className={cn(
          "size-[18px] transition-all duration-200 motion-reduce:transition-none",
          isLight ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
        )}
      />
      <Moon
        aria-hidden
        className={cn(
          "absolute size-[18px] transition-all duration-200 motion-reduce:transition-none",
          isLight ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0"
        )}
      />
    </button>
  );
}
