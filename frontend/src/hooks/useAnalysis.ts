import { useQuery } from "@tanstack/react-query";
import { getAnalysis } from "@/api/analyses.api";
import { analysesKeys } from "./useAnalyses";
import type { Analysis } from "@/types/analysis";

export function useAnalysis(id: string, enabled = true) {
  return useQuery<Analysis>({
    queryKey: analysesKeys.detail(id),
    queryFn: () => getAnalysis(id),
    enabled: enabled && id.length > 0,
    staleTime: Infinity,
  });
}
