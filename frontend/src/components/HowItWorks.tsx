import { BlurFade } from "./BlurFade";
import { TiltCard } from "./TiltCard";

const steps = [
  {
    n: "01",
    title: "Saisissez vos domaines",
    text: "Entrez 1 à 5 noms de domaine que vous envisagez d'acheter. Un seul champ, aucune configuration.",
  },
  {
    n: "02",
    title: "Collecte multi-sources",
    text: "Riskly interroge en parallèle RDAP, la résolution DNS, Tranco, Open PageRank et les bases de menaces PhishTank, URLhaus et OpenPhish.",
  },
  {
    n: "03",
    title: "Verdict expliqué",
    text: "Score de risque, score d'autorité et un verdict clair (Bon achat, Risqué ou À éviter), avec les raisons détaillées.",
  },
];

export default function HowItWorks() {
  return (
    <section id="fonctionnement" className="mx-auto max-w-6xl px-6 py-24">
      <BlurFade inView>
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          Comment ça marche
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-text-muted">
          De la saisie au verdict en quelques secondes.
        </p>
      </BlurFade>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <BlurFade key={s.n} inView delay={i * 0.15}>
            <TiltCard className="h-full rounded-xl border border-border bg-bg-elevated p-6 transition-colors hover:border-border-hover">
              <span className="font-mono text-sm text-accent">{s.n}</span>
              <h3 className="mt-3 font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{s.text}</p>
            </TiltCard>
          </BlurFade>
        ))}
      </div>
    </section>
  );
}
