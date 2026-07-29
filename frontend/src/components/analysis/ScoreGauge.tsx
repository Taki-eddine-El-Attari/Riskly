import { useEffect, useState } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  authorityBand,
  authorityIntensity,
  riskBand,
  toneStroke,
  toneText,
} from "@/lib/scores";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Kind = "risk" | "authority";

/**
 * Score 0–100 en jauge circulaire, avec sa bande d'interprétation.
 *
 * Couleur : le RISQUE se teinte par sa bande (vert / ambre / rouge) — c'est lui
 * qui porte l'alarme. L'AUTORITÉ reste en cyan, seule l'intensité du tracé
 * traduit la force (design.md §12.2).
 *
 * Le chiffre monte de 0 au score en ~1,2 s ; il s'affiche directement si
 * l'utilisateur a demandé moins d'animations.
 */
export function ScoreGauge({
  score,
  kind,
  size = 108,
  className,
}: {
  score: number | null;
  kind: Kind;
  size?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (score === null) return;
    if (reduced) {
      setShown(score);
      return;
    }
    const unsubscribe = motionValue.on("change", (v) => setShown(v));
    const controls = animate(motionValue, score, { duration: 1.2, ease: "easeOut" });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [score, reduced, motionValue]);

  const band = score === null ? null : kind === "risk" ? riskBand(score) : authorityBand(score);
  const tone = band?.tone ?? "faint";
  const opacity = kind === "authority" && score !== null ? authorityIntensity(score) : 1;
  const offset = CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, shown)) / 100);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            className="stroke-border"
          />
          {score !== null && (
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              opacity={opacity}
              className={cn(toneStroke[tone], "transition-none")}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score === null ? (
            <span className="font-mono text-lg text-text-faint" aria-label="Score indisponible">
              —
            </span>
          ) : (
            <>
              <span
                className={cn("font-mono text-2xl font-medium tabular-nums", toneText[tone])}
                style={{ opacity }}
              >
                {Math.round(shown)}
              </span>
              <span className="font-mono text-[10px] text-text-faint">/ 100</span>
            </>
          )}
        </div>
      </div>

      <p className="text-center">
        <span className="block font-mono text-[10px] uppercase tracking-widest text-text-faint">
          {kind === "risk" ? "Risque" : "Autorité"}
        </span>
        <span className={cn("mt-0.5 block text-xs font-medium", toneText[tone])}>
          {band ? band.label : "Non calculé"}
        </span>
      </p>
    </div>
  );
}
