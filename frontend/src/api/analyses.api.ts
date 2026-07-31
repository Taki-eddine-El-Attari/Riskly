// COUCHE 1 — ACCÈS. Aucune logique de présentation ici : on parle HTTP et on
// renvoie des objets conformes à `types/analysis.ts`.

import { apiClient, ApiError } from "@/lib/api-client";
import { DEMO_FALLBACK } from "@/lib/constants";
import { computeVerdict } from "@/lib/scores";
import type {
  Analysis,
  AnalysisBatchResult,
  AnalysisPage,
  Factor,
  Verdict,
} from "@/types/analysis";
import { normalizeVerdict } from "@/types/analysis";
import { demoAnalysis } from "./analyses.demo";
import {
  deleteDemoAnalysis,
  readDemoAnalysis,
  readDemoHistory,
  saveDemoAnalyses,
} from "@/lib/demo-history";

const BASE = "/api/v1/analyses";

/** SQLAlchemy sérialise `Numeric` en chaîne : on ramène tout en nombre. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
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
  };
}

/** Un domaine à analyser, avec son CSV de warm-up optionnel. */
export interface DomainEntry {
  domain: string;
  warmup?: File;
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
  if (entry.warmup) {
    const form = new FormData();
    form.append("domain_name", entry.domain);
    form.append("warmup_csv", entry.warmup, entry.warmup.name);
    return parseAnalysis(await apiClient.postForm<Record<string, unknown>>(BASE, form));
  }

  const raw = await apiClient.post<Record<string, unknown>>(BASE, {
    domain_name: entry.domain,
  });
  return parseAnalysis(raw);
}

/** Vrai quand l'API d'analyse n'est pas (encore) joignable — pas quand elle refuse. */
function isEndpointUnavailable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 404 || err.status === 501;
  return err instanceof TypeError; // fetch a échoué : serveur injoignable
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
  let endpointMissing = false;

  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
      return;
    }
    if (isEndpointUnavailable(outcome.reason)) endpointMissing = true;
    failed.push({
      domain: entries[i].domain,
      reason:
        outcome.reason instanceof Error
          ? outcome.reason.message
          : "Analyse impossible pour ce domaine.",
    });
  });

  // Repli de démonstration — voir analyses.demo.ts.
  if (DEMO_FALLBACK && endpointMissing && results.length === 0) {
    const demoResults = entries.map((e) => withComputedVerdict(demoAnalysis(e.domain)));
    // On enregistre le lot pour qu'il apparaisse dans l'historique (voir
    // demo-history.ts) : sans backend, c'est la seule mémoire des analyses.
    saveDemoAnalyses(demoResults);
    return { results: demoResults, failed: [], demo: true };
  }

  return { results, failed };
}

function withComputedVerdict(analysis: Analysis): Analysis {
  if (analysis.verdict || analysis.risk_score === null || analysis.authority_score === null) {
    return analysis;
  }
  return {
    ...analysis,
    verdict: computeVerdict(analysis.risk_score, analysis.authority_score),
  };
}

/** Paramètres de consultation de l'historique — miroir des query params backend. */
export interface HistoryParams {
  page?: number;
  pageSize?: number;
  sortBy?: "requested_at" | "risk_score" | "authority_score";
  order?: "asc" | "desc";
  verdict?: Verdict | null;
}

/** Une entrée d'historique locale se reconnaît à son identifiant `demo-…`. */
function isDemoId(id: string): boolean {
  return id.startsWith("demo-");
}

/**
 * Historique paginé de l'utilisateur connecté.
 * Quand l'endpoint n'est pas (encore) monté, on sert l'historique local des
 * analyses de démonstration — cohérent avec le repli de la page d'analyse.
 */
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

  try {
    return await apiClient.get<AnalysisPage>(`${BASE}?${query.toString()}`);
  } catch (err) {
    if (DEMO_FALLBACK && isEndpointUnavailable(err)) {
      return readDemoHistory({ page, pageSize, sortBy, order, verdict: params.verdict });
    }
    throw err;
  }
}

/** Rapport détaillé d'une analyse. */
export async function getAnalysis(id: string): Promise<Analysis> {
  // Un rapport de démonstration ne vit que localement : inutile d'appeler l'API.
  if (isDemoId(id)) {
    const stored = readDemoAnalysis(id);
    if (stored) return stored;
    throw new ApiError(404, "Analyse introuvable.");
  }

  try {
    const raw = await apiClient.get<Record<string, unknown>>(`${BASE}/${id}`);
    return parseAnalysis(raw);
  } catch (err) {
    if (DEMO_FALLBACK && isEndpointUnavailable(err)) {
      const stored = readDemoAnalysis(id);
      if (stored) return stored;
    }
    throw err;
  }
}

/** Retire une analyse de l'historique personnel. */
export async function deleteAnalysis(id: string): Promise<void> {
  if (isDemoId(id)) {
    deleteDemoAnalysis(id);
    return;
  }

  try {
    await apiClient.delete<void>(`${BASE}/${id}`);
  } catch (err) {
    if (DEMO_FALLBACK && isEndpointUnavailable(err)) {
      deleteDemoAnalysis(id);
      return;
    }
    throw err;
  }
}
