import { useEffect, useRef, useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AnalysisLoader } from "@/components/analysis/AnalysisLoader";
import { DomainInput } from "@/components/analysis/DomainInput";
import { DownloadMenu } from "@/components/analysis/DownloadMenu";
import { ReportList } from "@/components/analysis/ReportList";
import { Button } from "@/components/ui/button";
import type { DomainEntry } from "@/api/analyses.api";
import { useAnalyses } from "@/hooks/useAnalyses";
import { useAuth } from "@/hooks/useAuth";
import { MAX_DOMAINS } from "@/lib/constants";
import { VERDICT_ORDER, VERDICTS, toneBadge } from "@/lib/scores";
import { cn } from "@/lib/utils";

export default function Analyze() {
  const { user } = useAuth();
  const analyses = useAnalyses();
  const [submitted, setSubmitted] = useState<DomainEntry[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  const result = analyses.data;
  const hasResults = !analyses.isPending && (result?.results.length ?? 0) > 0;

  // Après une attente de plusieurs secondes, on amène l'utilisateur au rapport.
  useEffect(() => {
    if (!hasResults) return;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasResults]);

  function run(entries: DomainEntry[]) {
    setSubmitted(entries);
    analyses.mutate(entries);
  }

  return (
    <AppShell>
      {/* Zone de saisie */}
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
            pending={analyses.isPending}
            className="mt-8"
          />
        </div>
      </section>

      {/* Résultats */}
      <section ref={resultsRef} className="mx-auto max-w-6xl px-6 py-12">
        {analyses.isPending && (
          <AnalysisLoader
            domains={submitted.map((e) => e.domain)}
            className="mx-auto max-w-2xl"
          />
        )}

        {analyses.isError && !analyses.isPending && (
          <ErrorPanel
            message={analyses.error.message}
            onRetry={() => submitted.length > 0 && analyses.mutate(submitted)}
          />
        )}

        {!analyses.isPending && result && (
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
                    {/* Dès qu'il y a plusieurs domaines, un seul geste suffit
                        pour tout emporter — synthèse comparative comprise. */}
                    {result.results.length > 1 && (
                      <DownloadMenu
                        analyses={result.results}
                        variant="outline"
                        label={`Tout télécharger (${result.results.length})`}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        analyses.reset();
                        setSubmitted([]);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
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

        {!analyses.isPending && !analyses.isError && !result && <VerdictLegend />}
      </section>
    </AppShell>
  );
}

/** État initial : comment se lisent les résultats à venir. */
function VerdictLegend() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-mono text-xs uppercase tracking-widest text-text-faint">
        Comment lire le résultat
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {VERDICT_ORDER.map((verdict) => {
          const meta = VERDICTS[verdict];
          return (
            <div key={verdict} className="rounded-xl border border-border bg-bg-elevated p-5">
              <span
                className={cn(
                  "inline-flex rounded-md border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider",
                  toneBadge[meta.tone],
                )}
              >
                {meta.label}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">{meta.hint}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-text-faint">
        Le verdict croise le score de risque et le score d'autorité. Un risque
        faible signifie « aucun signal négatif détecté », pas « domaine sain » :
        la décision d'achat reste la vôtre.
      </p>
    </div>
  );
}

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
