import { BlurFade } from "./effects/BlurFade";
import { TiltCard } from "./effects/TiltCard";

type Feature = {
  spec: string;
  title: string;
  text: string;
  wide?: boolean;
};

const features: Feature[] = [
  {
    spec: "XGBoost + SHAP",
    title: "Score de risque explicable",
    text: "Un modèle XGBoost entraîné sur des signaux concrets : bases de menaces, ancienneté RDAP, configuration DNS, blacklists. Chaque point du score est justifié par SHAP, jamais une boîte noire.",
    wide: true,
  },
  {
    spec: "0,5 · 0,3 · 0,2",
    title: "Score d'autorité transparent",
    text: "Popularité Tranco, profil de backlinks et âge du domaine, combinés par une formule ouverte (0,5 rang + 0,3 backlinks + 0,2 âge). Pas un chiffre sorti d'un chapeau.",
  },
  {
    spec: "4 signaux",
    title: "Alertes de transparence",
    text: "Domaine très récent, aucune autorité, historique discontinu, présence dans une base de menaces : chaque signal s'affiche à part, sans fausser le score ni le verdict.",
  },
  {
    spec: "CSV optionnel",
    title: "Réputation email par warm-up",
    text: "Fournissez l'historique d'envoi du domaine et un second modèle évalue sa réputation d'envoi. Elle compte pour la moitié du score de valeur, à parts égales avec l'autorité — sans elle, le score repose sur l'autorité seule.",
  },
  {
    spec: "0,5 · 0,5",
    title: "Score de valeur transparent",
    text: "Autorité et réputation email combinées à parts égales, puis réduites par le score de risque : ≥ 60 % Bon achat, ≥ 30 % Risqué, en dessous À éviter. Au-delà de 50 % de risque, veto immédiat quel que soit le reste.",
  },
];

export default function Features() {
  return (
    <section id="fonctionnalites" className="mx-auto max-w-6xl px-6 py-24">
      <BlurFade inView>
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          Tout ce qu'il faut pour décider
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-text-muted">
          Un seul rapport, toutes les réponses qu'un acheteur de domaine se pose.
        </p>
      </BlurFade>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {features.map((f, i) => (
          <BlurFade
            key={f.title}
            inView
            delay={(i % 3) * 0.1}
            className={f.wide ? "md:col-span-2" : ""}
          >
            <TiltCard className="h-full rounded-xl border border-border bg-bg-elevated p-6 transition-colors hover:border-accent/40">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tracking-wider text-accent">
                  {f.spec}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{f.text}</p>
            </TiltCard>
          </BlurFade>
        ))}
      </div>
    </section>
  );
}
