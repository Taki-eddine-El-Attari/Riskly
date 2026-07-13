import {
  Ban,
  Brain,
  Calculator,
  History,
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
    text: "Un modèle ML entraîné sur des signaux concrets (blacklists, historique, WHOIS) — chaque point du score est justifié, pas de boîte noire.",
    wide: true,
  },
  {
    icon: Calculator,
    title: "Score de valeur transparent",
    text: "Longueur, extension, ancienneté, popularité Tranco, backlinks : une formule ouverte, pas un chiffre magique.",
  },
  {
    icon: Ban,
    title: "Veto Safe Browsing",
    text: "Un domaine signalé par Google Safe Browsing est automatiquement classé À éviter, quel que soit son score.",
  },
  {
    icon: Zap,
    title: "Résultats en secondes",
    text: "Collecte parallèle et cache 24h : les domaines déjà analysés répondent instantanément.",
  },
  {
    icon: History,
    title: "Historique personnel",
    text: "Retrouvez toutes vos analyses passées et suivez l'évolution d'un domaine dans le temps.",
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
