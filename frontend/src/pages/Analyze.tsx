import { useEffect, useRef, useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AnalysisLoader } from "@/components/analysis/AnalysisLoader";
import { BulkAnalysisProgress } from "@/components/analysis/BulkAnalysisProgress";
import { DomainInput } from "@/components/analysis/DomainInput";
import { DownloadMenu } from "@/components/analysis/DownloadMenu";
import { NO_SCORE_MESSAGE } from "@/components/analysis/ReportDetail";
import { ReportList } from "@/components/analysis/ReportList";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/landing/effects/BlurFade";
import { TiltCard } from "@/components/landing/effects/TiltCard";
import type { DomainEntry } from "@/api/analyses.api";
import { useAnalyses } from "@/hooks/useAnalyses";
import { useBulkAnalyses, type BulkDomainJob } from "@/hooks/useBulkAnalyses";
import { useAuth } from "@/hooks/useAuth";
import { MAX_DOMAINS } from "@/lib/constants";
import { VERDICT_ORDER, VERDICTS, toneBadge } from "@/lib/scores";
import { cn } from "@/lib/utils";

export default function Analyze() {
  const { user } = useAuth();
  const analyses = useAnalyses();
  const bulk = useBulkAnalyses();
  const [submitted, setSubmitted] = useState<DomainEntry[]>([]);
  const [bulkTotal, setBulkTotal] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  const pending = analyses.isPending || bulk.isPending;
  const result = analyses.data ?? bulk.data;
  const hasResults = !pending && (result?.results.length ?? 0) > 0;

  useEffect(() => {
    if (!hasResults) return;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasResults]);

  function run(entries: DomainEntry[]) {
    bulk.reset();
    setSubmitted(entries);
    analyses.mutate(entries);
  }

  function runBulk(jobs: BulkDomainJob[]) {
    if (jobs.length === 0) return;
    analyses.reset();
    setBulkTotal(jobs.length);
    bulk.mutate(jobs);
  }

  function reset() {
    analyses.reset();
    bulk.reset();
    setSubmitted([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AppShell>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />

        <div className="relative mx-auto max-w-3xl px-6 py-14">
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint">
            {user?.username ? `Bonjour ${user.username}` : "Nouvelle analyse"}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] md:text-4xl">
            Quel domaine analysons-nous ?
          </h1>
          <p className="mt-3 max-w-xl text-text-muted">
            Jusqu'à {MAX_DOMAINS} domaines par analyse. Riskly croise RDAP, DNS,
            Open PageRank et les bases de menaces, puis vous rend un score de
            risque expliqué.
          </p>

          <DomainInput
            onSubmit={run}
            onBulkImport={runBulk}
            pending={pending}
            className="mt-8"
          />
        </div>
      </section>

      <section ref={resultsRef} className="mx-auto max-w-6xl px-6 py-12">
        {analyses.isPending && (
          <AnalysisLoader
            domains={submitted.map((e) => e.domain)}
            className="mx-auto max-w-2xl"
          />
        )}

        {bulk.isPending && (
          <BulkAnalysisProgress
            progress={bulk.progress ?? { done: 0, total: bulkTotal }}
            className="mx-auto max-w-2xl"
          />
        )}

        {analyses.isError && !pending && (
          <ErrorPanel
            message={analyses.error.message}
            onRetry={() => submitted.length > 0 && analyses.mutate(submitted)}
          />
        )}

        {bulk.isError && !pending && <ErrorPanel message={bulk.error.message} onRetry={reset} />}

        {!pending && result && (
          <div className="space-y-6">
            {result.failed.length > 0 && (
              <div className="rounded-lg border border-avoid/30 bg-avoid/10 p-4">
                <p className="text-sm font-medium text-avoid">
                  {result.failed.length}{" "}
                  {result.failed.length > 1 ? "domaines n'ont pas pu être analysés" : "domaine n'a pas pu être analysé"}
                </p>
                <ul className="mt-2 space-y-1">
                  {result.failed.map((f) => (
                    <li key={f.domain} className="font-mono text-xs text-text-muted">
                      {f.domain} — {f.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.results.length > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-widest text-text-faint">
                    {result.results.length}{" "}
                    {result.results.length > 1 ? "rapports" : "rapport"} · triés par risque croissant
                  </p>

                  <div className="flex items-center gap-2">            
                    {result.results.length > 1 && (
                      <DownloadMenu
                        analyses={result.results}
                        variant="outline"
                        label={`Tout télécharger (${result.results.length})`}
                      />
                    )}
                    <Button variant="ghost" size="sm" onClick={reset}>
                      <RotateCcw aria-hidden />
                      Nouvelle analyse
                    </Button>
                  </div>
                </div>

                <ReportList analyses={result.results} />
              </>
            )}
          </div>
        )}

        {!pending && !analyses.isError && !bulk.isError && !result && <VerdictLegend />}
      </section>
    </AppShell>
  );
}

function VerdictLegend() {
  return (
    <div className="mx-auto max-w-5xl">
      <BlurFade inView>
        <h2 className="text-center font-display text-2xl font-bold md:text-3xl">
          Comment lire le résultat
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-text-muted">
          Le verdict croise le score de risque et le score d'autorité. Un
          risque faible signifie « aucun signal négatif détecté », pas
          « domaine sain » : la décision d'achat reste la vôtre.
        </p>
      </BlurFade>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {VERDICT_ORDER.map((verdict, i) => {
          const meta = VERDICTS[verdict];
          return (
            <BlurFade key={verdict} inView delay={i * 0.1}>
              <TiltCard className="h-full rounded-xl border border-border bg-bg-elevated p-5 transition-colors hover:border-accent/40">
                <span
                  className={cn(
                    "inline-flex rounded-md border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider",
                    toneBadge[meta.tone],
                  )}
                >
                  {meta.label}
                </span>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">{meta.hint}</p>
              </TiltCard>
            </BlurFade>
          );
        })}
      </div>

      <BlurFade inView>
        <h2 className="mt-20 text-center font-display text-2xl font-bold md:text-3xl">
          Les 4 scores d'un rapport
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-text-muted">
          Risque, autorité et warm-up sont mesurés indépendamment. La
          rentabilité est la seule à être calculée à partir des trois autres —
          c'est sa relation avec eux :
        </p>
      </BlurFade>

      <BlurFade inView delay={0.1}>
        <p className="mx-auto mt-6 max-w-xl rounded-lg border border-border bg-bg-elevated px-4 py-3 text-center font-mono text-sm text-text">
          rentabilité = (0,5 × autorité + 0,5 × warm-up) × (1 − risque)
        </p>
        <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-text-faint">
          Sans fichier de warm-up, seule l'autorité compte pour ce calcul —
          c'est la donnée disponible, pas un warm-up noté zéro. Et un risque de
          100 % écrase le résultat quel que soit le reste : la rentabilité
          tombe à 0 dès qu'un danger est confirmé.
        </p>
      </BlurFade>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SCORE_LEGEND.map((score, i) => (
          <BlurFade key={score.label} inView delay={i * 0.1}>
            <TiltCard className="h-full rounded-xl border border-border bg-bg-elevated p-5 transition-colors hover:border-accent/40">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tracking-wider text-accent">
                  {score.spec}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold">{score.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{score.hint}</p>
            </TiltCard>
          </BlurFade>
        ))}
      </div>

      <BlurFade inView>
        <h2 className="mt-20 text-center font-display text-2xl font-bold md:text-3xl">
          Cas particuliers
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-text-muted">
          Ce que le rapport affiche quand une donnée manque, plutôt que de la
          remplacer par une valeur par défaut.
        </p>
      </BlurFade>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {EDGE_CASES.map((edge, i) => (
          <BlurFade key={edge.spec} inView delay={i * 0.1}>
            <TiltCard className="h-full rounded-xl border border-border bg-bg-elevated p-5 transition-colors hover:border-accent/40">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tracking-wider text-accent">
                  {edge.spec}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold">{edge.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{edge.text}</p>
            </TiltCard>
          </BlurFade>
        ))}
      </div>
    </div>
  );
}

const SCORE_LEGEND = [
  {
    label: "Risque",
    spec: "0–100, bas = bon",
    hint: "Les signaux négatifs détectés (menaces connues, blacklists, historique discontinu…). Un score bas signifie « rien de suspect trouvé », pas « domaine certifié sain ».",
  },
  {
    label: "Autorité",
    spec: "0,5 · 0,3 · 0,2",
    hint: "autorité = 0,5 × rang (Open PageRank) + 0,3 × backlinks (échelle log) + 0,2 × âge du domaine. Une autorité forte ne compense jamais un risque élevé dans le verdict.",
  },
  {
    label: "Warm-up",
    spec: "CSV requis",
    hint: "La probabilité de succès d'une campagne email, calculée à partir du CSV d'historique d'envoi que vous fournissez. N'apparaît que si un fichier a été chargé pour ce domaine.",
  },
  {
    label: "Rentabilité",
    spec: "agrège tout",
    hint: "Combine risque, autorité et warm-up (quand il est disponible) en une seule mesure d'opportunité économique — à lire à part du verdict d'achat.",
  },
];

const EDGE_CASES = [
  {
    spec: "CSV fourni",
    title: "Un warm-up est transmis",
    text: "Le modèle calcule un score de réputation d'envoi (0–100) à partir de l'historique fourni. Il devient l'une des deux moitiés du calcul de rentabilité, aux côtés de l'autorité.",
  },
  {
    spec: "CSV absent",
    title: "Aucun warm-up fourni",
    text: "La jauge Warm-up n'apparaît pas du tout — ce n'est pas un score à zéro, juste une donnée non mesurée. La rentabilité se calcule alors sur la seule autorité.",
  },
  {
    spec: "DNS muet",
    title: "Domaine sans backlinks ni DNS",
    text: NO_SCORE_MESSAGE + " Le rapport affiche « Sans verdict » plutôt qu'un score forcé.",
  },
];

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl gap-3 rounded-xl border border-avoid/30 bg-avoid/10 p-5">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-avoid" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-text">L'analyse n'a pas abouti</p>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">{message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
