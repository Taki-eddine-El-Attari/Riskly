import { useId, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { ScoreGauge } from "./ScoreGauge";
import { VerdictBadge } from "./VerdictBadge";
import { NO_SCORE_MESSAGE, ReportDetail } from "./ReportDetail";
import { DownloadMenu } from "./DownloadMenu";
import { cn } from "@/lib/utils";
import { ALERTS, toneBadge, VERDICTS } from "@/lib/scores";
import type { Analysis } from "@/types/analysis";

function ageLabel(creationDate: string | null | undefined): string | null {
  if (!creationDate) return null;
  const created = new Date(creationDate);
  if (Number.isNaN(created.getTime())) return null;
  const days = Math.floor((Date.now() - created.getTime()) / 86_400_000);
  if (days < 0) return null;
  const years = Math.floor(days / 365);
  if (years >= 1) return `${years} an${years > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months >= 1) return `${months} mois`;
  return `${days} jour${days > 1 ? "s" : ""}`;
}

function keyFacts(analysis: Analysis): string[] {
  const facts: string[] = [];
  const { domain, metric } = analysis;

  if (domain?.tld) facts.push(domain.tld);
  const age = ageLabel(domain?.whois_creation_date);
  if (age) facts.push(age);
  if (typeof metric?.referring_domains_count === "number") {
    facts.push(`${metric.referring_domains_count.toLocaleString("fr-FR")} domaines référents`);
  }
  if (domain?.country) facts.push(domain.country);
  return facts;
}

function cacheLabel(cachedAt: string): string | null {
  const date = new Date(cachedAt);
  if (Number.isNaN(date.getTime())) return null;
  const hours = Math.round((Date.now() - date.getTime()) / 3_600_000);
  if (hours < 1) return "donnée de moins d'une heure";
  return `donnée d'il y a ${hours} h`;
}

export function ReportCard({
  analysis,
  defaultOpen = false,
  className,
}: {
  analysis: Analysis;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const detailId = useId();

  const domainName = analysis.domain?.domain_name ?? "Domaine inconnu";
  const alerts = analysis.alerts ?? [];
  const hasScore = analysis.risk_score !== null;
  const verdictMeta = analysis.verdict ? VERDICTS[analysis.verdict] : undefined;
  const verdictTone = verdictMeta?.tone ?? null;
  const cached = analysis.cached_at ? cacheLabel(analysis.cached_at) : null;
  const facts = keyFacts(analysis);

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-bg-elevated transition-colors duration-150 hover:border-border-hover",
        className,
      )}
    >
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="truncate font-mono text-lg text-text">{domainName}</h3>
            <VerdictBadge verdict={analysis.verdict} />
          </div>

          {hasScore && verdictMeta && (
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
              {verdictMeta.hint}
            </p>
          )}

          {!hasScore && (
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
              {NO_SCORE_MESSAGE}
            </p>
          )}

          {facts.length > 0 && (
            <p className="mt-3 font-mono text-xs text-text-faint">{facts.join("  ·  ")}</p>
          )}

          {alerts.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {alerts.map((alert) => {
                const meta = ALERTS[alert.code];
                if (!meta) return null;
                return (
                  <li
                    key={alert.code}
                    className={cn(
                      "rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
                      toneBadge[meta.tone],
                    )}
                  >
                    {meta.label}
                  </li>
                );
              })}
            </ul>
          )}

          {cached && (
            <p className="mt-3 flex items-center gap-1.5 font-mono text-xs text-text-faint">
              <Clock className="size-3" aria-hidden />
              Résultat servi depuis le cache · {cached}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-start justify-end gap-6 sm:gap-8">
          <ScoreGauge score={analysis.risk_score} kind="risk" size={96} />
          <ScoreGauge score={analysis.authority_score} kind="authority" size={96} />
          {analysis.email_health_score !== null && (
            <ScoreGauge score={analysis.email_health_score} kind="email_health" size={96} />
          )}
          <ScoreGauge score={analysis.profitability_score} kind="profitability" size={96} />
        </div>
      </div>

      <div
        className={cn(
          "border-t border-border px-6",
          verdictTone === "avoid" && "border-t-avoid/20",
        )}
      >
        <div className="flex items-center justify-between gap-2 py-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailId}
            className="inline-flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-text-muted outline-none transition-colors duration-150 hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent/30"
          >
            <span>{open ? "Masquer le détail" : "Voir le détail du rapport"}</span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-150 motion-reduce:transition-none",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>

          <DownloadMenu analyses={[analysis]} label="Télécharger" />
        </div>

        {open && <ReportDetail analysis={analysis} id={detailId} className="pb-6" />}
      </div>
    </article>
  );
}
