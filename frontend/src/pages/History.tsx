import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { DownloadMenu } from "@/components/analysis/DownloadMenu";
import { ReportDetail } from "@/components/analysis/ReportDetail";
import { VerdictBadge } from "@/components/analysis/VerdictBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useDeleteAnalysis } from "@/hooks/useDeleteAnalysis";
import { useHistory } from "@/hooks/useHistory";
import {
  emailHealthBand,
  profitabilityBand,
  riskBand,
  toneText,
  VERDICT_ORDER,
  VERDICTS,
} from "@/lib/scores";
import { cn } from "@/lib/utils";
import type { AnalysisSummary, Verdict } from "@/types/analysis";

const PAGE_SIZE = 10;

type VerdictFilter = Verdict | "all";
type Sort = "recent" | "risk_asc" | "risk_desc";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Plus récentes" },
  { value: "risk_asc", label: "Risque croissant" },
  { value: "risk_desc", label: "Risque décroissant" },
];

function sortParams(sort: Sort): {
  sortBy: "requested_at" | "risk_score";
  order: "asc" | "desc";
} {
  if (sort === "risk_asc") return { sortBy: "risk_score", order: "asc" };
  if (sort === "risk_desc") return { sortBy: "risk_score", order: "desc" };
  return { sortBy: "requested_at", order: "desc" };
}

export default function History() {
  const [verdict, setVerdict] = useState<VerdictFilter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(1);

  const { sortBy, order } = sortParams(sort);
  const history = useHistory({
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    order,
    verdict: verdict === "all" ? null : verdict,
  });

  const data = history.data;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered = verdict !== "all";

  function changeFilter(next: VerdictFilter) {
    setVerdict(next);
    setPage(1);
  }

  function changeSort(next: Sort) {
    setSort(next);
    setPage(1);
  }

  return (
    <AppShell>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-12">
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint">
            Historique
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] md:text-4xl">
            Mes analyses
          </h1>
          <p className="mt-3 max-w-xl text-text-muted">
            Retrouvez vos analyses passées, leur verdict et leur détail complet.
            Chaque rapport reste téléchargeable en PDF ou en CSV.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        {/* Barre de filtres */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={verdict === "all"} onClick={() => changeFilter("all")}>
              Tous
            </FilterChip>
            {VERDICT_ORDER.map((v) => (
              <FilterChip key={v} active={verdict === v} onClick={() => changeFilter(v)}>
                {VERDICTS[v].label}
              </FilterChip>
            ))}
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-text-faint">
            Trier
            <SortSelect value={sort} onChange={changeSort} />
          </div>
        </div>

        <div className="mt-8">
          {history.isPending && <HistorySkeleton />}

          {history.isError && !history.isPending && (
            <ErrorPanel
              message={history.error.message}
              onRetry={() => void history.refetch()}
            />
          )}

          {!history.isPending && !history.isError && data && (
            <>
              {data.items.length === 0 ? (
                <EmptyState filtered={isFiltered} onClear={() => changeFilter("all")} />
              ) : (
                <>
                  <p className="mb-4 font-mono text-xs uppercase tracking-widest text-text-faint">
                    {total} {total > 1 ? "analyses" : "analyse"}
                    {isFiltered && " · filtrées"}
                  </p>

                  <ul className="space-y-3">
                    {data.items.map((item) => (
                      <HistoryRow key={item.id} item={item} />
                    ))}
                  </ul>

                  {totalPages > 1 && (
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      busy={history.isFetching}
                      onPage={setPage}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}

// ── Ligne d'historique ───────────────────────────────────────────────────────

type ScoreKind = "risk" | "authority" | "profitability" | "email_health";

function scoreTone(kind: ScoreKind, score: number | null): string {
  if (score === null) return "text-text-faint";
  if (kind === "authority") return toneText.accent;
  if (kind === "profitability") return toneText[profitabilityBand(score).tone];
  if (kind === "email_health") return toneText[emailHealthBand(score).tone];
  return toneText[riskBand(score).tone];
}

function formatDateTime(value: string | null): string {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const READOUT_LABEL: Record<ScoreKind, string> = {
  risk: "Risque",
  authority: "Autorité",
  profitability: "Rentabilité",
  email_health: "Warm-up",
};

function ScoreReadout({
  kind,
  score,
}: {
  kind: ScoreKind;
  score: number | null;
}) {
  return (
    <div className="text-right">
      <span className="block font-mono text-[10px] uppercase tracking-widest text-text-faint">
        {READOUT_LABEL[kind]}
      </span>
      <span className={cn("font-mono text-xl font-medium tabular-nums", scoreTone(kind, score))}>
        {score === null ? "—" : Math.round(score)}
      </span>
    </div>
  );
}

function HistoryRow({ item }: { item: AnalysisSummary }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const detail = useAnalysis(item.id, open);
  const del = useDeleteAnalysis();

  const domainName = item.domain_name || "Domaine inconnu";

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-bg-elevated transition-colors duration-150 hover:border-border-hover">
      <div className="flex items-center gap-4 p-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-accent/30"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-text-faint transition-transform duration-150 motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="truncate font-mono text-base text-text">{domainName}</span>
              <VerdictBadge verdict={item.verdict} size="sm" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 font-mono text-xs text-text-faint">
                <Clock className="size-3" aria-hidden />
                {formatDateTime(item.requested_at)}
              </span>
              {item.warmup && (
                <span
                  className="flex min-w-0 items-center gap-1 font-mono text-xs text-text-faint"
                  title={`Warm-up : ${item.warmup.name}`}
                >
                  <FileSpreadsheet className="size-3 shrink-0 text-accent" aria-hidden />
                  <span className="max-w-[12rem] truncate">{item.warmup.name}</span>
                  {item.warmup.rows !== null && <span>· {item.warmup.rows} l.</span>}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="hidden shrink-0 items-start gap-6 sm:flex">
          <ScoreReadout kind="risk" score={item.risk_score} />
          <ScoreReadout kind="authority" score={item.authority_score} />
          {item.email_health_score !== null && (
            <ScoreReadout kind="email_health" score={item.email_health_score} />
          )}
          <ScoreReadout kind="profitability" score={item.profitability_score} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            to={`/history/${item.id}`}
            aria-label="Ouvrir le rapport"
            title="Ouvrir le rapport"
            className="rounded-lg p-2 text-text-muted outline-none transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent/30"
          >
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={del.isPending}
            aria-label="Supprimer l'analyse"
            title="Supprimer l'analyse"
            className="rounded-lg p-2 text-text-muted outline-none transition-colors duration-150 hover:bg-avoid/10 hover:text-avoid focus-visible:ring-[3px] focus-visible:ring-avoid/30 disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-avoid/20 bg-avoid/5 px-5 py-3">
          <p className="text-sm text-text-muted">
            Supprimer l'analyse de <span className="font-mono text-text">{domainName}</span> ?
            Cette action est définitive.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={del.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                del.mutate(item.id, { onSuccess: () => setConfirming(false) })
              }
              disabled={del.isPending}
            >
              {del.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Supprimer
            </Button>
          </div>
        </div>
      )}

      {del.isError && (
        <p className="border-t border-avoid/20 bg-avoid/5 px-5 py-2 text-xs text-avoid">
          La suppression a échoué : {del.error.message}
        </p>
      )}

      {open && (
        <div className="border-t border-border px-5 py-5">
          {detail.isPending && (
            <div className="flex items-center gap-2 py-6 text-sm text-text-faint">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Chargement du rapport…
            </div>
          )}

          {detail.isError && (
            <div className="flex items-center justify-between gap-3 py-2">
              <p className="text-sm text-avoid">
                Le rapport n'a pas pu être chargé : {detail.error.message}
              </p>
              <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>
                <RotateCcw aria-hidden />
                Réessayer
              </Button>
            </div>
          )}

          {detail.data && (
            <>
              <div className="mb-6 flex items-center justify-end gap-2">
                <DownloadMenu
                  analyses={[detail.data]}
                  variant="outline"
                  label="Télécharger"
                />
              </div>
              <ReportDetail analysis={detail.data} />
            </>
          )}
        </div>
      )}
    </li>
  );
}

// ── Sous-composants d'état ───────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-3 py-1.5 font-mono text-xs outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-accent/30",
        active
          ? "bg-bg-elevated text-text ring-1 ring-inset ring-border"
          : "text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Menu de tri façon select moderne, bâti sur le `dropdown-menu` maison (Radix) —
 * même grammaire que le reste de l'app, surface elevated, focus cyan, coche sur
 * l'option active. Aucune dépendance supplémentaire.
 */
function SortSelect({
  value,
  onChange,
}: {
  value: Sort;
  onChange: (sort: Sort) => void;
}) {
  const current = SORTS.find((s) => s.value === value) ?? SORTS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text outline-none transition-colors duration-150",
          "hover:border-border-hover focus-visible:ring-[3px] focus-visible:ring-accent/30 data-[state=open]:border-accent/60",
        )}
      >
        <span className="font-mono">{current.label}</span>
        <ChevronDown
          className="size-3.5 text-text-faint transition-transform duration-150 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[11rem]">
        {SORTS.map((s) => {
          const active = s.value === value;
          return (
            <DropdownMenuItem
              key={s.value}
              onSelect={() => onChange(s.value)}
              className={cn("justify-between font-mono text-xs", active && "text-text")}
            >
              {s.label}
              <Check
                className={cn("size-3.5 text-accent", active ? "opacity-100" : "opacity-0")}
                aria-hidden
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Pagination({
  page,
  totalPages,
  busy,
  onPage,
}: {
  page: number;
  totalPages: number;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-center gap-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1 || busy}
      >
        Précédent
      </Button>
      <span className="flex items-center gap-2 font-mono text-xs text-text-faint">
        {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
        Page {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages || busy}
      >
        Suivant
      </Button>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <ul className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="h-[86px] animate-pulse rounded-xl border border-border bg-bg-elevated"
        />
      ))}
    </ul>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-bg-elevated p-10 text-center">
      <Search className="mx-auto size-8 text-text-faint" aria-hidden />
      {filtered ? (
        <>
          <p className="mt-4 font-medium text-text">Aucune analyse pour ce filtre</p>
          <p className="mt-2 text-sm text-text-muted">
            Aucune de vos analyses ne correspond à ce verdict.
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={onClear}>
            Voir toutes les analyses
          </Button>
        </>
      ) : (
        <>
          <p className="mt-4 font-medium text-text">Aucune analyse pour l'instant</p>
          <p className="mt-2 text-sm text-text-muted">
            Vos analyses apparaîtront ici dès votre première recherche de domaine.
          </p>
          <Button asChild size="sm" className="mt-5">
            <Link to="/app">Lancer une analyse</Link>
          </Button>
        </>
      )}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl gap-3 rounded-xl border border-avoid/30 bg-avoid/10 p-5">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-avoid" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-text">L'historique n'a pas pu être chargé</p>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">{message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
