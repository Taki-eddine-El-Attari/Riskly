import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BlurFade } from "./BlurFade";

// Accordéon FAQ avec animations douces d'ouverture et de fermeture.
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
  const [openIndices, setOpenIndices] = useState<number[]>([]);

  const toggle = (i: number) => {
    setOpenIndices((prev) =>
      prev.includes(i) ? prev.filter((idx) => idx !== i) : [...prev, i]
    );
  };

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <BlurFade inView>
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          Questions fréquentes
        </h2>
      </BlurFade>

      <div className="mt-12 space-y-3">
        {faqs.map((f, i) => {
          const isOpen = openIndices.includes(i);
          return (
            <BlurFade key={f.q} inView delay={i * 0.08}>
              <div className="rounded-xl border border-border bg-bg-elevated transition-colors hover:border-border-hover">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left font-medium text-text outline-none"
                >
                  <span>{f.q}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-text-faint transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-text" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-text-muted">
                        {f.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </BlurFade>
          );
        })}
      </div>
    </section>
  );
}
