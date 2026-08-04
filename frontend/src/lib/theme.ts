import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "riskly-theme";

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

function startThemeTransition(mutate: () => void) {
  const doc = document as ViewTransitionDocument;
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (typeof doc.startViewTransition !== "function" || prefersReduced) {
    mutate();
    return;
  }
  doc.startViewTransition(mutate);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  const setTheme = useCallback((next: Theme) => {
    startThemeTransition(() => applyTheme(next));
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(readTheme() === "light" ? "dark" : "light");
  }, [setTheme]);

  useEffect(() => {
    function updateFromDOM() {
      setThemeState(readTheme());
    }

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          updateFromDOM();
        }
      }
    });

    if (typeof document !== "undefined") {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    function onStorage(e: StorageEvent) {
      if (e.key !== THEME_STORAGE_KEY || !e.newValue) return;
      const next: Theme = e.newValue === "light" ? "light" : "dark";
      document.documentElement.classList.toggle("light", next === "light");
      setThemeState(next);
    }
    window.addEventListener("storage", onStorage);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { theme, setTheme, toggle };
}
