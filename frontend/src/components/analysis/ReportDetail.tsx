import type { ReactNode } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { AlertList } from "./AlertList";
import { FactorGauges } from "./FactorGauges";
import { MissingDataNotice } from "./MissingDataNotice";
import { warmupDownloadUrl } from "@/api/analyses.api";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/warmup";
import type { Analysis } from "@/types/analysis";

function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd
        className={cn(
          "shrink-0 font-mono text-xs",
          value ? "text-text" : "text-text-faint",
        )}
      >
        {value ?? "Non collecté"}
      </dd>
    </div>
  );
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCount(value: number | null | undefined): string | null {
  return typeof value === "number" ? value.toLocaleString("fr-FR") : null;
}

export const NO_SCORE_MESSAGE =
  "Le domaine ne répond pas en DNS : ni classement, ni backlinks, ni pays " +
  "d'hébergement n'ont pu être mesurés. C'est courant pour un domaine expiré " +
  "ou en vente, mais aucun verdict ne peut être fondé là-dessus — vérifiez " +
  "son historique manuellement.";

export function ReportDetail({
  analysis,
  id,
  className,
  headerActions,
}: {
  analysis: Analysis;
  id?: string;
  className?: string;
  headerActions?: ReactNode;
}) {
  const { domain, metric, warmup } = analysis;
  const factors = analysis.shap_values ?? [];
  const alerts = analysis.alerts ?? [];
  const missing = analysis.missing_sources ?? [];

  return (
    <div id={id} className={cn("space-y-8", className)}>
      {factors.length > 0 ? (
        <FactorGauges factors={factors} headerActions={headerActions} />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-text-faint">
            {analysis.risk_score === null
              ? NO_SCORE_MESSAGE
              : "Les facteurs explicatifs ne sont pas disponibles pour cette analyse."}
          </p>
          {headerActions}
        </div>
      )}

      {alerts.length > 0 && <AlertList alerts={alerts} />}

      <section>
        <h4 className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
          Données collectées
        </h4>
        <dl className="mt-3 grid gap-x-8 rounded-lg border border-border bg-bg-elevated/40 px-4 py-1 sm:grid-cols-2">
          <DataRow label="Extension" value={domain?.tld ?? null} />
          <DataRow
            label="Longueur du nom"
            value={
              typeof domain?.domain_length === "number"
                ? `${domain.domain_length} caractères`
                : null
            }
          />
          <DataRow label="Tirets" value={formatCount(domain?.hyphen_count)} />
          <DataRow label="Enregistré le" value={formatDate(domain?.whois_creation_date)} />
          <DataRow label="Expire le" value={formatDate(domain?.whois_expiration_date)} />
          <DataRow label="Pays d'hébergement" value={domain?.country ?? null} />
          <DataRow
            label="Classement Open PageRank"
            value={
              typeof metric?.rank_value === "number"
                ? `${metric.rank_value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 10`
                : null
            }
          />
          <DataRow
            label="Domaines référents"
            value={formatCount(metric?.referring_domains_count)}
          />
          <DataRow label="Serveurs de noms" value={formatCount(metric?.nb_server_count)} />
          <DataRow
            label="Blacklists DNS"
            value={
              typeof metric?.is_blacklisted === "boolean"
                ? metric.is_blacklisted
                  ? "Présent sur au moins une liste"
                  : "Aucune liste"
                : null
            }
          />
        </dl>
      </section>

      {warmup && (
        <section>
          <h4 className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
            Fichier de warm-up fourni
          </h4>
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-bg-elevated/40 px-4 py-3">
            <FileSpreadsheet className="size-4 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm text-text">{warmup.name}</p>
              <p className="mt-0.5 font-mono text-xs text-text-faint">
                {warmup.rows !== null &&
                  `${warmup.rows.toLocaleString("fr-FR")} ligne${warmup.rows > 1 ? "s" : ""} · `}
                {formatBytes(warmup.size)}
              </p>
            </div>
            <a
              href={warmupDownloadUrl(analysis.id)}
              download={warmup.name}
              aria-label="Télécharger le fichier de warm-up"
              title="Télécharger le fichier de warm-up"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs text-text-muted outline-none transition-colors duration-150 hover:border-border-hover hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent/30"
            >
              <Download className="size-3.5" aria-hidden />
              Télécharger
            </a>
          </div>
        </section>
      )}

      {missing.length > 0 && <MissingDataNotice sources={missing} />}
    </div>
  );
}
