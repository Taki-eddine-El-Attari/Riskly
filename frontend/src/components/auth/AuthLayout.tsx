import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Globe } from "@/components/Globe";
import { RisklyLogo } from "@/components/RisklyLogo";
import { Separator } from "@/components/ui/separator";

function Logo() {
  return (
    <Link to="/" className="flex w-fit items-center gap-2">
      <RisklyLogo className="h-6 w-auto" />
      <span className="font-display text-lg font-bold">Riskly</span>
    </Link>
  );
}

/** Séparateur « ou » entre OAuth et formulaire email. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-4" role="separator" aria-label={label}>
      <Separator className="flex-1" />
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-text-faint">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

/**
 * Écran scindé des pages auth : panneau globe (branding) à gauche,
 * formulaire à droite. Le panneau gauche disparaît sous lg.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Panneau globe, desktop uniquement */}
      <section className="relative hidden overflow-hidden border-r border-border bg-bg-elevated/30 lg:block">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative flex h-full min-h-screen flex-col justify-between gap-6 p-10">
          <Logo />

          <div className="mx-auto w-full max-w-md">
            <h2 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em]">
              Chaque domaine a un passé.{" "}
              <span className="text-accent">Riskly le vérifie.</span>
            </h2>
            <p className="mt-3 text-sm text-text-muted">
              Des sources publiques croisées en temps réel, sur tous les TLD,
              partout dans le monde, avant que vous ne payiez.
            </p>
            <Globe className="mx-auto mt-8 w-full max-w-[min(26rem,56vh)]" />
          </div>

          <p className="font-mono text-xs text-text-faint">
            RDAP · Tranco · Open PageRank · PhishTank · URLhaus · DNS
          </p>
        </div>
      </section>

      {/* Panneau formulaire */}
      <section className="flex flex-col px-6 py-8 sm:px-10">
        <header className="lg:hidden">
          <Logo />
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <p className="text-center font-mono text-xs text-text-faint">
          © 2026 Riskly · Domain Risk Analyzer
        </p>
      </section>
    </main>
  );
}
