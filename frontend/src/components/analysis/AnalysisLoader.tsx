import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { ANALYSIS_BUDGET_MS, SOURCES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * L'attente d'une analyse (jusqu'à 15 s par domaine), habillée en terminal —
 * l'esthétique de la landing, réemployée là où l'utilisateur patiente.
 *
 * Honnêteté de l'affichage : les sources s'allument au rythme du budget de
 * temps annoncé, mais la dernière ligne reste en cours tant que la réponse
 * réelle n'est pas arrivée. On ne coche jamais une étape qu'on ne peut pas
 * vérifier.
 */
export function AnalysisLoader({
  domains,
  className,
}: {
  domains: string[];
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  // Le budget vaut par domaine, la collecte est parallèle entre sources.
  const interval = Math.max(
    600,
    (ANALYSIS_BUDGET_MS * Math.max(1, domains.length)) / (SOURCES.length + 2),
  );

  useEffect(() => {
    if (reduced) return;
    // On s'arrête avant la dernière source : elle reste « en cours ».
    if (step >= SOURCES.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), interval);
    return () => clearTimeout(t);
  }, [step, interval, reduced]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {/* Barre de fenêtre */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-avoid/60" />
          <span className="size-2.5 rounded-full bg-risky/60" />
          <span className="size-2.5 rounded-full bg-good/60" />
        </div>
        <span className="font-mono text-xs text-text-faint">riskly · analyse</span>
        <span className="ml-auto font-mono text-xs text-text-faint">
          {domains.length} {domains.length > 1 ? "domaines" : "domaine"}
        </span>
      </div>

      <div className="p-5">
        <p className="font-mono text-sm text-text">
          <span className="text-accent">$</span> analyse{" "}
          <span className="text-text-muted">{domains.join(" ")}</span>
        </p>

        <ul className="mt-4 space-y-2.5">
          {SOURCES.map((source, i) => {
            const done = !reduced && i < step;
            const running = reduced || i === step;

            return (
              <li key={source} className="flex items-center gap-3 font-mono text-xs">
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {done ? (
                    <Check className="size-3.5 text-good" aria-hidden />
                  ) : running ? (
                    <Loader2
                      className="size-3.5 animate-spin text-accent motion-reduce:animate-none"
                      aria-hidden
                    />
                  ) : (
                    <span className="size-1.5 rounded-full bg-border" aria-hidden />
                  )}
                </span>
                <span className={done || running ? "text-text-muted" : "text-text-faint"}>
                  {source}
                </span>
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span className={done ? "text-good" : "text-text-faint"}>
                  {done ? "collecté" : running ? "en cours" : "en attente"}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 border-t border-border pt-4 text-xs text-text-muted">
          Collecte en parallèle puis calcul du score. Une source qui ne répond
          pas est signalée dans le rapport, elle n'interrompt pas l'analyse.
        </p>
      </div>
    </div>
  );
}
