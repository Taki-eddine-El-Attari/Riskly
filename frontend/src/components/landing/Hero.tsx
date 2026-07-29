import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Globe } from "lucide-react";
import { BlurFade } from "./effects/BlurFade";
import { BorderBeam } from "./effects/BorderBeam";
import { useTypingPlaceholder } from "@/hooks/useTypingPlaceholder";

// Mêmes exemples que le champ d'analyse de l'app (components/analysis/DomainInput).
const examples = [
  "exemple-domaine.com",
  "boutique-mode.fr",
  "crypto-invest.io",
  "agence-web.ma",
];

export default function Hero() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const typed = useTypingPlaceholder(examples, focused || value.length > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    navigate("/register");
  }

  return (
    <section className="relative overflow-hidden">
      {/* Couches de fond : grille, halo, RISKLY en outline */}
      <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
      {/* SVG Filter qui génère le contour externe exact de la police sans les lignes internes de chevauchement de glyphes */}
      <svg width="0" height="0" className="pointer-events-none absolute size-0 overflow-hidden" aria-hidden>
        <defs>
          <filter id="text-outline-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feMorphology in="SourceAlpha" result="expanded" operator="dilate" radius="1.2" />
            <feComposite in="expanded" in2="SourceAlpha" operator="out" result="outline" />
            <feFlood floodColor="currentColor" result="color" />
            <feComposite in="color" in2="outline" operator="in" />
          </filter>
        </defs>
      </svg>

      <p
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display text-[22vw] font-bold leading-none text-text-faint opacity-15"
        style={{ filter: "url(#text-outline-filter)" }}
      >
        RISKLY
      </p>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
        <BlurFade duration={0.6} blur="8px" yOffset={10}>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-[-0.02em] md:text-6xl">
            Sachez si un domaine vaut son prix{" "}
            <span className="text-accent">avant de l'acheter.</span>
          </h1>
        </BlurFade>

        {/* <BlurFade delay={0.2} duration={0.6}>
          <p className="mt-6 max-w-xl text-lg text-text-muted">
            Score de risque, score d'autorité et verdict clair, croisés depuis
            RDAP, Tranco, Open PageRank et les bases de menaces PhishTank,
            URLhaus et OpenPhish.
          </p>
        </BlurFade> */}

        <BlurFade delay={0.35} duration={0.6} blur="10px" yOffset={12} className="w-full max-w-xl">
          <form
            onSubmit={submit}
            className="relative mt-10 w-full rounded-2xl border border-border bg-bg-elevated/80 p-2 shadow-2xl backdrop-blur transition-colors focus-within:border-accent/60"
          >
            <BorderBeam size={120} duration={7} />
            <div className="flex items-center gap-3 px-3">
              <Globe className="size-5 shrink-0 text-text-faint" />
              <div className="relative min-w-0 flex-1 overflow-hidden">
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  aria-label="Nom de domaine à analyser"
                  spellCheck={false}
                  className="w-full bg-transparent py-4 font-mono text-base text-text outline-none"
                />
                {value === "" && (
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center font-mono text-base text-text-faint">
                    {typed}
                    <span className="typing-caret ml-0.5 h-5 w-px bg-accent" />
                  </span>
                )}
              </div>
              <button
                type="submit"
                aria-label="Analyser"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-3 font-medium text-bg transition-opacity hover:opacity-90 sm:px-5"
              >
                <span className="hidden sm:inline">Analyser</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        </BlurFade>

        <BlurFade delay={0.5} duration={0.6}>
          <p className="mt-4 font-mono text-xs text-text-faint">
            Jusqu'à 5 domaines par analyse · verdict en moins de 15 secondes ·
            gratuit
          </p>
        </BlurFade>
      </div>
    </section>
  );
}
