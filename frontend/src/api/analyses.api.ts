import { apiClient } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/constants";
import { computeVerdict } from "@/lib/scores";
import type {
  Analysis,
  AnalysisBatchResult,
  AnalysisPage,
  AnalysisSummary,
  Factor,
  Verdict,
  WarmupInfo,
} from "@/types/analysis";
import { normalizeVerdict } from "@/types/analysis";
import type { WarmupFile } from "@/lib/warmup";

const BASE = "/api/v1/analyses";

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

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
export function parseAnalysis(raw: Record<string, unknown>): Analysis {
  const risk = num(raw.risk_score);
  const authority = num(raw.authority_score);
  const emailHealth = num(raw.email_health_score);
  const verdict = normalizeVerdict(raw.verdict);

  return {
    id: String(raw.id ?? ""),
    status: (raw.status as Analysis["status"]) ?? null,
    risk_score: risk,
    authority_score: authority,
    profitability_score: num(raw.profitability_score),
    email_health_score: emailHealth,
    verdict:
      verdict ??
      (risk !== null && authority !== null
        ? computeVerdict(risk, authority, emailHealth)
        : null),
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

function parseAnalysisSummary(raw: Record<string, unknown>): AnalysisSummary {
  const risk = num(raw.risk_score);
  const authority = num(raw.authority_score);
  const emailHealth = num(raw.email_health_score);
  const verdict = normalizeVerdict(raw.verdict);

  return {
    id: String(raw.id ?? ""),
    domain_name: String(raw.domain_name ?? ""),
    risk_score: risk,
    authority_score: authority,
    profitability_score: num(raw.profitability_score),
    email_health_score: emailHealth,
    verdict:
      verdict ??
      (risk !== null && authority !== null
        ? computeVerdict(risk, authority, emailHealth)
        : null),
    requested_at: (raw.requested_at as string) ?? null,
    status: (raw.status as AnalysisSummary["status"]) ?? null,
    warmup: parseWarmup(raw.warmup),
  };
}

export function warmupDownloadUrl(analysisId: string): string {
  return `${API_BASE_URL}${BASE}/${analysisId}/warmup/download`;
}

export interface DomainEntry {
  domain: string;
  warmup?: WarmupFile;
}

function warmupInfoOf(warmup: WarmupFile): WarmupInfo {
  return { name: warmup.file.name, size: warmup.file.size, rows: warmup.rows };
}

export async function createAnalysis(entry: DomainEntry): Promise<Analysis> {
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
export function foldResults(
  domains: string[],
  settled: PromiseSettledResult<Analysis>[],
): AnalysisBatchResult {
  const results: Analysis[] = [];
  const failed: AnalysisBatchResult["failed"] = [];

  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
      return;
    }
    failed.push({
      domain: domains[i],
      reason:
        outcome.reason instanceof Error
          ? outcome.reason.message
          : "Analyse impossible pour ce domaine.",
    });
  });

  return { results, failed };
}

export async function createAnalyses(entries: DomainEntry[]): Promise<AnalysisBatchResult> {
  const settled = await Promise.allSettled(entries.map(createAnalysis));
  return foldResults(entries.map((e) => e.domain), settled);
}

export interface HistoryParams {
  page?: number;
  pageSize?: number;
  sortBy?: "requested_at" | "risk_score" | "authority_score" | "profitability_score";
  order?: "asc" | "desc";
  verdict?: Verdict | null;
}

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

  const raw = await apiClient.get<{
    items: Record<string, unknown>[];
    total: number;
    page: number;
    page_size: number;
  }>(`${BASE}?${query.toString()}`);

  return {
    items: raw.items.map(parseAnalysisSummary),
    total: raw.total,
    page: raw.page,
    page_size: raw.page_size,
  };
}

export async function getAnalysis(id: string): Promise<Analysis> {
  const raw = await apiClient.get<Record<string, unknown>>(`${BASE}/${id}`);
  return parseAnalysis(raw);
}

export async function deleteAnalysis(id: string): Promise<void> {
  await apiClient.delete<void>(`${BASE}/${id}`);
}
