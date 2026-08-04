import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BlurFade } from "./effects/BlurFade";

const faqs = [
  {
    q: "D'où viennent les données ?",
    a: "De sources publiques : RDAP, Tranco, Open PageRank, la résolution DNS et les bases de menaces PhishTank, URLhaus et OpenPhish. La seule donnée que vous fournissez vous-même est le CSV de warm-up, optionnel, pour évaluer la réputation d'envoi. Aucune donnée inventée : si une source ne répond pas, le rapport le signale.",
  },
  {
    q: "Comment le score de risque est-il calculé ?",
    a: "Un modèle XGBoost combine les signaux collectés : présence dans une base de menaces, ancienneté RDAP, configuration DNS, blacklists. Chaque facteur qui pèse sur le score est détaillé dans le rapport, via SHAP, donc le verdict reste toujours explicable. À partir de 50 %, le domaine est classé DANGEREUX et le verdict s'arrête là.",
  },
  {
    q: "Et le score d'autorité ?",
    a: "Une formule transparente : 0,5 × rang Open PageRank + 0,3 × backlinks + 0,2 × âge du domaine. Ce n'est pas une estimation de prix de revente, mais un indicateur d'autorité comparable d'un domaine à l'autre.",
  },
  {
    q: "À quoi sert le CSV de warm-up ?",
    a: "À faire évaluer la réputation d'envoi du domaine par un second modèle, entraîné spécifiquement sur des historiques de campagnes email. Cette réputation compte pour la moitié du score de valeur, à parts égales avec l'autorité. Sans warm-up fourni, le score de valeur repose sur l'autorité seule — l'absence de donnée n'est jamais comptée comme une mauvaise réputation.",
  },
  {
    q: "Comment le verdict final est-il obtenu ?",
    a: "Le score de valeur (0,5 × autorité + 0,5 × réputation email) est réduit par le score de risque, puis comparé à deux seuils : 60 % pour « Bon achat », 30 % pour « Risqué », en dessous c'est « À éviter ». Un domaine dont le DNS ne répond pas du tout (rien à mesurer) reçoit « Données insuffisantes » plutôt qu'un verdict forcé.",
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
