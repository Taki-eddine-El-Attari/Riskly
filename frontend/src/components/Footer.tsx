import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { RisklyLogo } from "./RisklyLogo";
import { BlurFade } from "./BlurFade";
import { AnimatedGridPattern } from "./AnimatedGridPattern";

export default function Footer() {
  return (
    <>
      <section className="relative overflow-hidden border-t border-border">
        <AnimatedGridPattern
          numSquares={40}
          maxOpacity={0.12}
          duration={3}
          className="fill-accent stroke-border/60 [mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
        />
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <BlurFade inView>
          <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
            <h2 className="font-display text-3xl font-bold md:text-5xl">
              Prêt à analyser votre premier domaine ?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-text-muted">
              Créez un compte gratuit et obtenez un verdict en quelques secondes.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-4 font-medium text-bg transition-opacity hover:opacity-90"
            >
              Commencer gratuitement
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </BlurFade>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <div className="flex items-center gap-2">
            <RisklyLogo className="h-5 w-auto" />
            <span className="font-display font-bold">Riskly</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-text-muted">
            <a href="#fonctionnement" className="transition-colors hover:text-text">
              Fonctionnement
            </a>
            <a href="#sources" className="transition-colors hover:text-text">
              Sources
            </a>
            <a href="#faq" className="transition-colors hover:text-text">
              FAQ
            </a>
          </div>
        </div>

        {/* Wordmark géant façon Komta : dégradé qui s'estompe vers le bas */}
        <div className="overflow-hidden px-6" aria-hidden>
          <p className="select-none whitespace-nowrap text-center font-display text-[21vw] font-bold leading-[0.8] tracking-[-0.03em]">
            <span className="bg-gradient-to-b from-text/20 to-text/[0.02] bg-clip-text text-transparent">
              Riskly
            </span>
          </p>
        </div>

        <div className="border-t border-border">
          <p className="mx-auto max-w-6xl px-6 py-5 text-center font-mono text-xs text-text-faint">
            © 2026 Riskly · Domain Risk Analyzer
          </p>
        </div>
      </footer>
    </>
  );
}
