// COUCHE 2 — LOGIQUE. Historique paginé de l'utilisateur (TanStack Query).

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getHistory } from "@/api/analyses.api";
import type { HistoryParams } from "@/api/analyses.api";
import { analysesKeys } from "./useAnalyses";
import type { AnalysisPage } from "@/types/analysis";

/**
 * Liste les analyses passées, triées et filtrées côté serveur.
 * `keepPreviousData` garde l'ancienne page affichée pendant le chargement de la
 * suivante : la pagination ne fait pas clignoter la liste.
 */
export function useHistory(params: HistoryParams) {
  return useQuery<AnalysisPage>({
    queryKey: [...analysesKeys.history, params],
    queryFn: () => getHistory(params),
    placeholderData: keepPreviousData,
  });
}
