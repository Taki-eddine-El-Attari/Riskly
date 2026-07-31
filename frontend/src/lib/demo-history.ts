// Historique de démonstration — pendant local de `analyses.demo.ts`.
//
// Les routes `/analyses` ne sont pas encore montées côté backend
// (app/api/v1/router.py n'inclut que `auth`). Tant qu'elles ne répondent pas,
// les analyses lancées depuis /app ne sont persistées nulle part côté serveur.
// Pour que « mes analyses » restent consultables — et téléchargeables — dans la
// page Historique, on les conserve localement (localStorage), exactement comme
// la page d'analyse s'appuie sur des rapports d'exemple quand l'API est muette.
//
// À SUPPRIMER une fois l'endpoint disponible : ce fichier et les replis qui
// l'appellent dans `analyses.api.ts` sont les seuls points à retirer.

import type {
  Analysis,
  AnalysisPage,
  AnalysisSummary,
  Verdict,
} from "@/types/analysis";

const KEY = "riskly:demo-history";
/** On garde un historique borné : au-delà, on oublie les plus anciennes. */
const MAX_ENTRIES = 100;

function available(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

/** Lit l'historique complet, du plus récent au plus ancien. Jamais d'exception. */
function readAll(): Analysis[] {
  if (!available()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Analysis[]) : [];
  } catch {
    return [];
  }
}

function writeAll(analyses: Analysis[]) {
  if (!available()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(analyses.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota atteint ou stockage indisponible : on abandonne silencieusement */
  }
}

/**
 * Enregistre les rapports d'un lot en tête d'historique.
 * Ré-analyser un domaine déjà présent remplace son entrée (même identifiant
 * stable) et la fait remonter — on ne duplique pas.
 */
export function saveDemoAnalyses(analyses: Analysis[]) {
  if (analyses.length === 0) return;
  const incoming = analyses.filter((a) => a.id);
  const ids = new Set(incoming.map((a) => a.id));
  const kept = readAll().filter((a) => !ids.has(a.id));
  writeAll([...incoming, ...kept]);
}

/** Retire une analyse de l'historique local. */
export function deleteDemoAnalysis(id: string) {
  writeAll(readAll().filter((a) => a.id !== id));
}

/** Rapport complet d'une analyse enregistrée localement, ou `null`. */
export function readDemoAnalysis(id: string): Analysis | null {
  return readAll().find((a) => a.id === id) ?? null;
}

/** Vrai lorsqu'au moins une analyse a été enregistrée localement. */
export function hasDemoHistory(): boolean {
  return readAll().length > 0;
}

interface HistoryQuery {
  page: number;
  pageSize: number;
  sortBy: "requested_at" | "risk_score" | "authority_score";
  order: "asc" | "desc";
  verdict?: Verdict | null;
}

function summarize(a: Analysis): AnalysisSummary {
  return {
    id: a.id,
    domain_name: a.domain?.domain_name ?? "",
    risk_score: a.risk_score,
    authority_score: a.authority_score,
    verdict: a.verdict,
    requested_at: a.requested_at,
    status: a.status,
  };
}

/** Reproduit le tri/filtre/pagination du backend sur l'historique local. */
export function readDemoHistory(query: HistoryQuery): AnalysisPage {
  const { page, pageSize, sortBy, order, verdict } = query;

  let items = readAll();
  if (verdict) items = items.filter((a) => a.verdict === verdict);

  const direction = order === "asc" ? 1 : -1;
  items = [...items].sort((a, b) => {
    if (sortBy === "requested_at") {
      const left = a.requested_at ? Date.parse(a.requested_at) : 0;
      const right = b.requested_at ? Date.parse(b.requested_at) : 0;
      return (left - right) * direction;
    }
    // Une valeur absente est reléguée en fin de liste, quel que soit le sens.
    const left = a[sortBy];
    const right = b[sortBy];
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * direction;
  });

  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize).map(summarize),
    total,
    page,
    page_size: pageSize,
  };
}
