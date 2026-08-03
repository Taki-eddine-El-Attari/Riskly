// COUCHE 2 — LOGIQUE. Pont entre l'API et l'UI (TanStack Query).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAnalyses } from "@/api/analyses.api";
import type { DomainEntry } from "@/api/analyses.api";
import type { AnalysisBatchResult } from "@/types/analysis";

export const analysesKeys = {
  history: ["analyses", "history"] as const,
  detail: (id: string) => ["analyses", "detail", id] as const,
};

/**
 * Lance l'analyse d'un lot de domaines, chacun avec son CSV de warm-up
 * optionnel.
 * L'appel est long (jusqu'à 15 s par domaine) : la page affiche
 * `AnalysisLoader` pendant `isPending`. L'historique est invalidé à la fin,
 * chaque analyse y ayant été enregistrée côté serveur.
 */
export function useAnalyses() {
  const queryClient = useQueryClient();

  return useMutation<AnalysisBatchResult, Error, DomainEntry[]>({
    mutationFn: (entries) => createAnalyses(entries),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: analysesKeys.history });
    },
  });
}
