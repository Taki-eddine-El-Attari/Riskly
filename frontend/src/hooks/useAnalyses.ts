import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAnalyses } from "@/api/analyses.api";
import type { DomainEntry } from "@/api/analyses.api";
import type { AnalysisBatchResult } from "@/types/analysis";

export const analysesKeys = {
  history: ["analyses", "history"] as const,
  detail: (id: string) => ["analyses", "detail", id] as const,
};

export function useAnalyses() {
  const queryClient = useQueryClient();

  return useMutation<AnalysisBatchResult, Error, DomainEntry[]>({
    mutationFn: (entries) => createAnalyses(entries),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: analysesKeys.history });
    },
  });
}
