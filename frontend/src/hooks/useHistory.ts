import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getHistory } from "@/api/analyses.api";
import type { HistoryParams } from "@/api/analyses.api";
import { analysesKeys } from "./useAnalyses";
import type { AnalysisPage } from "@/types/analysis";

export function useHistory(params: HistoryParams) {
  return useQuery<AnalysisPage>({
    queryKey: [...analysesKeys.history, params],
    queryFn: () => getHistory(params),
    placeholderData: keepPreviousData,
  });
}
