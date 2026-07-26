import { Fragment, useState } from "react";
import { BlurFade } from "./BlurFade";

type Verdict = "good" | "risky" | "avoid";

const verdictStyle: Record<Verdict, string> = {
  good: "border-good/30 bg-good/10 text-good",
  risky: "border-risky/30 bg-risky/10 text-risky",
  avoid: "border-avoid/30 bg-avoid/10 text-avoid",
};

const verdictHoverStyle: Record<Verdict, string> = {
  good: "border-good bg-good/25 shadow-[0_0_20px_rgba(34,197,94,0.3)]",
  risky: "border-risky bg-risky/25 shadow-[0_0_20px_rgba(245,158,11,0.3)]",
  avoid: "border-avoid bg-avoid/25 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
};

const verdictLabel: Record<Verdict, string> = {
  good: "Bon achat",
  risky: "Risqué",
  avoid: "À éviter",
};

// lignes = risque (faible -> élevé), colonnes = autorité (forte -> faible).
// Reprend la matrice de décision finale du PRD (section 10).
const matrix: Verdict[][] = [
  ["good", "good", "risky"],
  ["risky", "risky", "avoid"],
  ["avoid", "avoid", "avoid"],
];

const riskLabels = [
  { name: "Risque faible", band: "0–25" },
  { name: "Risque modéré", band: "26–60" },
  { name: "Risque élevé", band: "61–100" },
];

const authorityLabels = [
  { name: "Autorité forte", band: "66–100" },
  { name: "Autorité correcte", band: "31–65" },
  { name: "Autorité faible", band: "0–30" },
];

export default function DecisionMatrix() {
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <BlurFade inView>
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          La matrice de décision
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-text-muted">
          Chaque domaine se lit sur deux axes, le risque et l'autorité. Le
          risque prime : un domaine à risque élevé finit sur « À éviter », même
          quand son autorité est forte.
        </p>
      </BlurFade>

      <BlurFade inView delay={0.15}>
        <div className="mx-auto mt-14 max-w-2xl">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2">
            <span />
            {authorityLabels.map((a, ci) => {
              const isColActive = hovered?.col === ci;
              return (
                <span
                  key={a.name}
                  className={`flex flex-col items-center pb-2 text-center font-mono text-xs transition-all duration-200 ${
                    isColActive
                      ? "scale-105 font-bold text-accent drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                      : hovered
                      ? "text-text-faint/50"
                      : "text-text-faint"
                  }`}
                >
                  {a.name}
                  <span
                    className={`text-[10px] transition-colors ${
                      isColActive ? "text-accent/90 font-semibold" : "text-text-faint/70"
                    }`}
                  >
                    {a.band}
                  </span>
                </span>
              );
            })}

            {matrix.map((row, ri) => {
              const isRowActive = hovered?.row === ri;
              return (
                <Fragment key={riskLabels[ri].name}>
                  <span
                    className={`flex flex-col justify-center pr-3 font-mono text-xs transition-all duration-200 ${
                      isRowActive
                        ? "scale-105 font-bold text-accent drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                        : hovered
                        ? "text-text-faint/50"
                        : "text-text-faint"
                    }`}
                  >
                    {riskLabels[ri].name}
                    <span
                      className={`text-[10px] transition-colors ${
                        isRowActive ? "text-accent/90 font-semibold" : "text-text-faint/70"
                      }`}
                    >
                      {riskLabels[ri].band}
                    </span>
                  </span>
                  {row.map((v, ci) => {
                    const isHovered = hovered?.row === ri && hovered?.col === ci;

                    return (
                      <div
                        key={`${ri}-${ci}`}
                        onMouseEnter={() => setHovered({ row: ri, col: ci })}
                        onMouseLeave={() => setHovered(null)}
                        className={`relative flex h-20 cursor-pointer items-center justify-center rounded-lg border font-mono text-xs font-medium uppercase tracking-wider transition-all duration-200 md:h-24 ${
                          isHovered
                            ? `z-10 scale-[1.04] ${verdictHoverStyle[v]}`
                            : verdictStyle[v]
                        }`}
                      >
                        {verdictLabel[v]}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
          <p className="mt-4 text-center font-mono text-xs text-text-faint">
            Les alertes (domaine très récent, base de menaces, historique
            discontinu) éclairent la lecture sans jamais changer le verdict.
          </p>
        </div>
      </BlurFade>
    </section>
  );
}
