import { ArrowDown, Scale, ShieldAlert } from "lucide-react";
import { BlurFade } from "./effects/BlurFade";

type Tone = "avoid" | "accent" | "good" | "risky";

const toneText: Record<Tone, string> = {
  avoid: "text-avoid",
  accent: "text-accent",
  good: "text-good",
  risky: "text-risky",
};

const toneBorder: Record<Tone, string> = {
  avoid: "border-avoid/30",
  accent: "border-accent/30",
  good: "border-good/30",
  risky: "border-risky/30",
};

const verdicts: { label: string; rule: string; tone: Tone }[] = [
  { label: "Bon achat", rule: "score de valeur ≥ 60 %", tone: "good" },
  { label: "Risqué", rule: "score de valeur ≥ 30 %", tone: "risky" },
  { label: "À éviter", rule: "score de valeur < 30 %", tone: "avoid" },
];

export default function DecisionMatrix() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <BlurFade inView>
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          Comment le verdict est calculé
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-text-muted">
          Trois étapes, dans cet ordre : la sécurité prime toujours sur la
          valeur, jamais l'inverse.
        </p>
      </BlurFade>

      <div className="mx-auto mt-14 flex max-w-2xl flex-col items-center gap-3">
        <div className={`w-full rounded-xl border ${toneBorder.avoid} bg-bg-elevated p-6`}>
          <div className="flex items-center gap-3">
            <ShieldAlert className={`size-5 shrink-0 ${toneText.avoid}`} aria-hidden />
            <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
              Étape 1 · Verrou sécurité
            </span>
          </div>
          <p className="mt-3 font-mono text-sm text-text">
            Score de risque ≥ 50 % <span className="text-text-faint">→</span>{" "}
            <span className={toneText.avoid}>DANGEREUX</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Veto immédiat, quels que soient l'autorité ou le warm-up : un
            domaine suspect n'est jamais « rattrapé » par un bon score
            ailleurs.
          </p>
        </div>

        <ArrowDown className="size-4 shrink-0 text-text-faint" aria-hidden />

        <div className={`w-full rounded-xl border ${toneBorder.accent} bg-bg-elevated p-6`}>
          <div className="flex items-center gap-3">
            <Scale className={`size-5 shrink-0 ${toneText.accent}`} aria-hidden />
            <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
              Étape 2 · Score de valeur
            </span>
          </div>
          <p className="mt-3 font-mono text-sm text-text">
            0,5 × autorité + 0,5 × réputation email
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Sans CSV de warm-up, le score repose sur l'autorité seule — la
            réputation email absente n'est jamais comptée comme mauvaise.
            Le résultat est ensuite réduit par le score de risque, même
            sous le seuil de veto.
          </p>
        </div>

        <ArrowDown className="size-4 shrink-0 text-text-faint" aria-hidden />

        <div className="w-full rounded-xl border border-border bg-bg-elevated p-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
              Étape 3 · Verdict
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {verdicts.map((v) => (
              <li
                key={v.label}
                className={`flex items-center justify-between gap-4 rounded-lg border ${toneBorder[v.tone]} bg-bg/40 px-4 py-2.5`}
              >
                <span className={`font-mono text-xs font-medium uppercase tracking-wider ${toneText[v.tone]}`}>
                  {v.label}
                </span>
                <span className="font-mono text-xs text-text-faint">{v.rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-xl text-center font-mono text-xs text-text-faint">
        Domaine muet en DNS (aucun rang, aucun backlink) : Riskly renvoie
        « Données insuffisantes » plutôt qu'un verdict forcé sur un modèle
        entraîné uniquement sur des domaines actifs.
      </p>
    </section>
  );
}
