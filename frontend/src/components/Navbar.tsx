import { Link } from "react-router-dom";
import { RisklyLogo } from "./RisklyLogo";

const links = [
  { label: "Fonctionnement", href: "#fonctionnement" },
  { label: "Sources", href: "#sources" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
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

        <div className="flex items-center gap-3">
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
      </nav>
    </header>
  );
}
