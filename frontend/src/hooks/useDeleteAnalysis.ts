// COUCHE 2 — LOGIQUE. Suppression d'une analyse de l'historique (TanStack Query).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteAnalysis } from "@/api/analyses.api";
import { analysesKeys } from "./useAnalyses";

/**
 * Retire une analyse de l'historique personnel.
 * À la réussite, on invalide l'historique pour que la liste se rafraîchisse
 * (l'entrée supprimée disparaît, le total se recale).
 */
export function useDeleteAnalysis() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteAnalysis(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: analysesKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: analysesKeys.history });
    },
  });
}
