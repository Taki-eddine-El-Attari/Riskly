import { ChevronDown } from "lucide-react";
import { BlurFade } from "./BlurFade";

// ponytail: <details>/<summary> natif, accessible et sans JS, pas besoin d'accordéon maison
const faqs = [
  {
    q: "D'où viennent les données ?",
    a: "Exclusivement de sources publiques : RDAP, Tranco, Open PageRank, la résolution DNS et les bases de menaces PhishTank, URLhaus et OpenPhish. Aucune donnée inventée : si une source ne répond pas, le rapport le signale.",
  },
  {
    q: "Comment le score de risque est-il calculé ?",
    a: "Un modèle XGBoost combine les signaux collectés : présence dans une base de menaces, ancienneté RDAP, configuration DNS, blacklists. Chaque facteur qui pèse sur le score est détaillé dans le rapport, via SHAP, donc le verdict reste toujours explicable.",
  },
  {
    q: "Et le score d'autorité ?",
    a: "Une formule transparente : 0,5 × rang Open PageRank + 0,3 × backlinks + 0,2 × âge du domaine. Ce n'est pas une estimation de prix de revente, mais un indicateur d'autorité comparable d'un domaine à l'autre.",
  },
  {
    q: "Puis-je analyser plusieurs domaines à la fois ?",
    a: "Oui, jusqu'à 5 domaines par requête. Les résultats s'affichent côte à côte pour comparer facilement.",
  },
  {
    q: "Les résultats sont-ils en temps réel ?",
    a: "Les sources sont interrogées en direct, avec un cache de 24 heures : un domaine déjà analysé récemment répond instantanément.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <BlurFade inView>
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          Questions fréquentes
        </h2>
      </BlurFade>

      <div className="mt-12 space-y-3">
        {faqs.map((f, i) => (
          <BlurFade key={f.q} inView delay={i * 0.08}>
            <details className="group rounded-xl border border-border bg-bg-elevated transition-colors hover:border-border-hover open:border-border-hover">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-text-faint transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-text-muted">{f.a}</p>
            </details>
          </BlurFade>
        ))}
      </div>
    </section>
  );
}
