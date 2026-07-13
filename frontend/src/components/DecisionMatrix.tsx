import { Fragment } from "react";
import { BlurFade } from "./BlurFade";

type Verdict = "good" | "risky" | "avoid";

const verdictStyle: Record<Verdict, string> = {
  good: "border-good/30 bg-good/10 text-good hover:bg-good/25 hover:border-good",
  risky: "border-risky/30 bg-risky/10 text-risky hover:bg-risky/25 hover:border-risky",
  avoid: "border-avoid/30 bg-avoid/10 text-avoid hover:bg-avoid/25 hover:border-avoid",
};

const verdictLabel: Record<Verdict, string> = {
  good: "Bon achat",
  risky: "Risqué",
  avoid: "À éviter",
};

// lignes = valeur (élevée → faible), colonnes = risque (faible → élevé)
const matrix: Verdict[][] = [
  ["good", "risky", "avoid"],
  ["good", "risky", "avoid"],
  ["risky", "risky", "avoid"],
];

const valueLabels = ["Valeur élevée", "Valeur moyenne", "Valeur faible"];
const riskLabels = ["Risque faible", "Risque moyen", "Risque élevé"];

export default function DecisionMatrix() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <BlurFade inView>
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          La matrice de décision
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-text-muted">
          Chaque domaine est positionné sur deux axes — risque et valeur — et le
          verdict tombe. Le veto Safe Browsing court-circuite tout.
        </p>
      </BlurFade>

      <BlurFade inView delay={0.15}>
        <div className="mx-auto mt-14 max-w-2xl">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2">
            <span />
            {riskLabels.map((r) => (
              <span
                key={r}
                className="pb-2 text-center font-mono text-xs text-text-faint"
              >
                {r}
              </span>
            ))}

            {matrix.map((row, ri) => (
              <Fragment key={valueLabels[ri]}>
                <span className="flex items-center pr-3 font-mono text-xs text-text-faint">
                  {valueLabels[ri]}
                </span>
                {row.map((v, ci) => (
                  <div
                    key={`${ri}-${ci}`}
                    className={`flex h-20 cursor-default items-center justify-center rounded-lg border font-mono text-xs font-medium uppercase tracking-wider transition-all md:h-24 ${verdictStyle[v]}`}
                  >
                    {verdictLabel[v]}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
          <p className="mt-4 text-center font-mono text-xs text-text-faint">
            Signalé par Google Safe Browsing → À éviter, sans exception.
          </p>
        </div>
      </BlurFade>
    </section>
  );
}
