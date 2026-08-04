import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteAnalysis } from "@/api/analyses.api";
import { analysesKeys } from "./useAnalyses";

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
