// COUCHE 1 — ACCÈS. Aucune logique de présentation ici : on parle HTTP et on
// renvoie des objets conformes à `types/analysis.ts`.

import { apiClient } from "@/lib/api-client";
import { computeVerdict } from "@/lib/scores";
import type {
  Analysis,
  AnalysisBatchResult,
  AnalysisPage,
  Factor,
  Verdict,
  WarmupInfo,
} from "@/types/analysis";
import { normalizeVerdict } from "@/types/analysis";
import type { WarmupFile } from "@/lib/warmup";

const BASE = "/api/v1/analyses";

/** SQLAlchemy sérialise `Numeric` en chaîne : on ramène tout en nombre. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Normalise les métadonnées de warm-up renvoyées par le backend (à venir). */
function parseWarmup(raw: unknown): WarmupInfo | null {
  if (typeof raw !== "object" || raw === null) return null;
  const w = raw as Record<string, unknown>;
  const name = typeof w.name === "string" ? w.name : "";
  if (name.length === 0) return null;
  return {
    name,
    size: num(w.size) ?? 0,
    rows: num(w.rows),
  };
}

function parseFactors(raw: unknown): Factor[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => ({
      feature: String(f.feature ?? ""),
      value: (f.value ?? null) as Factor["value"],
      contribution: num(f.contribution) ?? 0,
    }))
    .filter((f) => f.feature.length > 0);
}

/**
 * Normalise une réponse brute du backend.
 * Le verdict du serveur fait autorité ; s'il est absent alors que les deux
 * scores sont présents, on applique la matrice du PRD — déterministe, donc
 * aucune donnée inventée.
 */
export function parseAnalysis(raw: Record<string, unknown>): Analysis {
  const risk = num(raw.risk_score);
  const authority = num(raw.authority_score);
  const verdict = normalizeVerdict(raw.verdict);

  return {
    id: String(raw.id ?? ""),
    status: (raw.status as Analysis["status"]) ?? null,
    risk_score: risk,
    authority_score: authority,
    profitability_score: num(raw.profitability_score),
    email_health_score: num(raw.email_health_score),
    verdict:
      verdict ??
      (risk !== null && authority !== null ? computeVerdict(risk, authority) : null),
    shap_values: parseFactors(raw.shap_values),
    requested_at: (raw.requested_at as string) ?? null,
    completed_at: (raw.completed_at as string) ?? null,
    domain: (raw.domain as Analysis["domain"]) ?? null,
    alerts: (raw.alerts as Analysis["alerts"]) ?? undefined,
    missing_sources: (raw.missing_sources as string[]) ?? undefined,
    cached_at: (raw.cached_at as string) ?? null,
    metric: (raw.metric as Analysis["metric"]) ?? null,
    warmup: parseWarmup(raw.warmup),
  };
}

/** Un domaine à analyser, avec son CSV de warm-up optionnel (fichier + comptage). */
export interface DomainEntry {
  domain: string;
  warmup?: WarmupFile;
}

/** Métadonnées affichables d'un warm-up — jamais son contenu. */
function warmupInfoOf(warmup: WarmupFile): WarmupInfo {
  return { name: warmup.file.name, size: warmup.file.size, rows: warmup.rows };
}

/**
 * Lance l'analyse d'UN domaine.
 *
 * Contrat attendu côté backend :
 * - sans warm-up → `application/json` : `{ "domain_name": "..." }` ;
 * - avec warm-up → `multipart/form-data` : champ `domain_name` + fichier
 *   `warmup_csv`. Le CSV est facultatif : l'analyse aboutit sans lui.
 */
export async function createAnalysis(entry: DomainEntry): Promise<Analysis> {
  // Le backend ne renvoie pas (encore) les métadonnées du fichier : on les
  // porte depuis la saisie pour qu'elles apparaissent dans le rapport, les
  // exports et l'historique. Le contenu du CSV, lui, ne quitte pas la requête.
  const info = entry.warmup ? warmupInfoOf(entry.warmup) : null;

  if (entry.warmup) {
    const form = new FormData();
    form.append("domain_name", entry.domain);
    form.append("warmup_csv", entry.warmup.file, entry.warmup.file.name);
    const parsed = parseAnalysis(await apiClient.postForm<Record<string, unknown>>(BASE, form));
    return info ? { ...parsed, warmup: parsed.warmup ?? info } : parsed;
  }

  const raw = await apiClient.post<Record<string, unknown>>(BASE, {
    domain_name: entry.domain,
  });
  return parseAnalysis(raw);
}

/**
 * Lance l'analyse d'un lot de 1 à 5 domaines.
 * Le backend n'expose qu'un endpoint mono-domaine : on parallélise et on isole
 * les échecs — un domaine qui tombe n'empêche pas les autres (PRD, UC-03 A7).
 */
export async function createAnalyses(entries: DomainEntry[]): Promise<AnalysisBatchResult> {
  const settled = await Promise.allSettled(entries.map(createAnalysis));

  const results: Analysis[] = [];
  const failed: AnalysisBatchResult["failed"] = [];

  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
      return;
    }
    failed.push({
      domain: entries[i].domain,
      reason:
        outcome.reason instanceof Error
          ? outcome.reason.message
          : "Analyse impossible pour ce domaine.",
    });
  });

  return { results, failed };
}

/** Paramètres de consultation de l'historique — miroir des query params backend. */
export interface HistoryParams {
  page?: number;
  pageSize?: number;
  sortBy?: "requested_at" | "risk_score" | "authority_score";
  order?: "asc" | "desc";
  verdict?: Verdict | null;
}

/** Historique paginé de l'utilisateur connecté. */
export async function getHistory(params: HistoryParams = {}): Promise<AnalysisPage> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const sortBy = params.sortBy ?? "requested_at";
  const order = params.order ?? "desc";

  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort_by: sortBy,
    order,
  });
  if (params.verdict) query.set("verdict", params.verdict);

  return await apiClient.get<AnalysisPage>(`${BASE}?${query.toString()}`);
}

/** Rapport détaillé d'une analyse. */
export async function getAnalysis(id: string): Promise<Analysis> {
  const raw = await apiClient.get<Record<string, unknown>>(`${BASE}/${id}`);
  return parseAnalysis(raw);
}

/** Retire une analyse de l'historique personnel. */
export async function deleteAnalysis(id: string): Promise<void> {
  await apiClient.delete<void>(`${BASE}/${id}`);
}
