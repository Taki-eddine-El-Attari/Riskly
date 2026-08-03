// COUCHE 2 — LOGIQUE. Rapport détaillé d'une analyse (TanStack Query).

import { useQuery } from "@tanstack/react-query";
import { getAnalysis } from "@/api/analyses.api";
import { analysesKeys } from "./useAnalyses";
import type { Analysis } from "@/types/analysis";

/**
 * Charge le rapport complet d'une analyse à la demande.
 * `enabled` diffère l'appel jusqu'à ce que l'utilisateur ouvre la ligne
 * d'historique : on ne va chercher le détail que de ce qu'il consulte
 * réellement. Un rapport ne change jamais après coup (PRD, UC-06), d'où le
 * `staleTime` infini — une fois chargé, il reste en cache.
 */
export function useAnalysis(id: string, enabled = true) {
  return useQuery<Analysis>({
    queryKey: analysesKeys.detail(id),
    queryFn: () => getAnalysis(id),
    enabled: enabled && id.length > 0,
    staleTime: Infinity,
  });
}
