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
} from "@/types/analysis";
import { normalizeVerdict } from "@/types/analysis";
import { demoAnalysis } from "./analyses.demo";

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

/** Lance l'analyse d'UN domaine. */
export async function createAnalysis(domainName: string): Promise<Analysis> {
  const raw = await apiClient.post<Record<string, unknown>>(BASE, {
    domain_name: domainName,
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
export async function createAnalyses(domains: string[]): Promise<AnalysisBatchResult> {
  const settled = await Promise.allSettled(domains.map(createAnalysis));

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
      domain: domains[i],
      reason:
        outcome.reason instanceof Error
          ? outcome.reason.message
          : "Analyse impossible pour ce domaine.",
    });
  });

  // Repli de démonstration — voir analyses.demo.ts.
  if (DEMO_FALLBACK && endpointMissing && results.length === 0) {
    return {
      results: domains.map(demoAnalysis).map(withComputedVerdict),
      failed: [],
      demo: true,
    };
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

/** Historique paginé de l'utilisateur connecté. */
export function getHistory(page = 1, pageSize = 20): Promise<AnalysisPage> {
  return apiClient.get<AnalysisPage>(`${BASE}?page=${page}&page_size=${pageSize}`);
}

/** Rapport détaillé d'une analyse. */
export async function getAnalysis(id: string): Promise<Analysis> {
  const raw = await apiClient.get<Record<string, unknown>>(`${BASE}/${id}`);
  return parseAnalysis(raw);
}

/** Retire une analyse de l'historique personnel. */
export function deleteAnalysis(id: string): Promise<void> {
  return apiClient.delete<void>(`${BASE}/${id}`);
}
