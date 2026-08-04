import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { RisklyLogo } from "./RisklyLogo";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { label: "Sources", href: "#sources" },
  { label: "Fonctionnement", href: "#fonctionnement" },
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <RisklyLogo className="h-6 w-auto" />
          <span className="font-display text-lg font-bold">Riskly</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-text-muted transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text"
          >
            Se connecter
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Créer un compte
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            className="relative inline-flex size-9 items-center justify-center rounded-lg text-text-muted outline-none transition-colors hover:bg-bg-elevated hover:text-text focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/30"
          >
            <motion.span
              animate={{ rotate: open ? 90 : 0, opacity: open ? 0 : 1, scale: open ? 0.6 : 1 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Menu className="size-5" aria-hidden />
            </motion.span>
            <motion.span
              animate={{ rotate: open ? 0 : -90, opacity: open ? 1 : 0, scale: open ? 1 : 0.6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <X className="size-5" aria-hidden />
            </motion.span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.button
            key="backdrop"
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 bottom-0 z-40 cursor-default bg-black/40 backdrop-blur-sm sm:hidden"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full z-50 border-t border-border bg-bg shadow-lg sm:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-bg-elevated hover:text-text"
                >
                  {l.label}
                </a>
              ))}

              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-center text-sm text-text-muted transition-colors hover:bg-bg-elevated hover:text-text"
                >
                  Se connecter
                </Link>
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-medium text-bg transition-opacity hover:opacity-90"
                >
                  Créer un compte
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
