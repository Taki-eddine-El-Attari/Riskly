import {
  Brain,
  Calculator,
  History,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BlurFade } from "./BlurFade";
import { TiltCard } from "./TiltCard";

type Feature = {
  icon: LucideIcon;
  title: string;
  text: string;
  wide?: boolean;
};

const features: Feature[] = [
  {
    icon: Brain,
    title: "Score de risque explicable",
    text: "Un modèle XGBoost entraîné sur des signaux concrets : bases de menaces, ancienneté RDAP, configuration DNS, blacklists. Chaque point du score est justifié par SHAP, jamais une boîte noire.",
    wide: true,
  },
  {
    icon: Calculator,
    title: "Score d'autorité transparent",
    text: "Popularité Tranco, profil de backlinks et âge du domaine, combinés par une formule ouverte (0,5 rang + 0,3 backlinks + 0,2 âge). Pas un chiffre sorti d'un chapeau.",
  },
  {
    icon: TriangleAlert,
    title: "Alertes de transparence",
    text: "Domaine très récent, aucune autorité, historique discontinu, présence dans une base de menaces : chaque signal s'affiche à part, sans fausser le score ni le verdict.",
  },
  {
    icon: Zap,
    title: "Résultats en moins de 15 s",
    text: "Collecte parallèle et cache de 24 h : une nouvelle analyse tient sous les 15 secondes, et un domaine déjà vu répond aussitôt.",
  },
  {
    icon: History,
    title: "Historique personnel",
    text: "Retrouvez vos analyses passées, horodatées, et rouvrez chaque rapport tel qu'il a été produit ce jour-là.",
  },
];

export default function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
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
              <f.icon className="size-6 text-accent" />
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{f.text}</p>
            </TiltCard>
          </BlurFade>
        ))}
      </div>
    </section>
  );
}
