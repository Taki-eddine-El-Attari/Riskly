import { useCallback, useEffect, useState } from "react";

/**
 * Gestion du thème clair / sombre.
 *
 * Le SOMBRE est le défaut (dark-first). Le CLAIR s'active en posant la classe
 * `.light` sur <html> ; les tokens CSS correspondants vivent dans index.css.
 * La classe initiale est posée par un script anti-FOUC dans index.html AVANT
 * le rendu React, pour éviter tout flash au chargement — ce hook se contente
 * ensuite de lire, basculer et persister le choix.
 */

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "riskly-theme";

/** Lit le thème réellement appliqué au document (source de vérité = le DOM). */
function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

/** Applique un thème : classe sur <html>, persistance, sans toucher au state. */
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // stockage indisponible (mode privé, quota) : le thème reste valable pour la session.
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(readTheme() === "light" ? "dark" : "light");
  }, [setTheme]);

  // Synchronise les onglets ouverts : une bascule ailleurs se reflète ici.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== THEME_STORAGE_KEY || !e.newValue) return;
      const next: Theme = e.newValue === "light" ? "light" : "dark";
      document.documentElement.classList.toggle("light", next === "light");
      setThemeState(next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { theme, setTheme, toggle };
}
