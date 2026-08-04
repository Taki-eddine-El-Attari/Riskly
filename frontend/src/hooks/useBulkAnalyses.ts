import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAnalysis, foldResults } from "@/api/analyses.api";
import { analysesKeys } from "@/hooks/useAnalyses";
import { runWithConcurrency, type PoolProgress } from "@/lib/asyncPool";
import { BULK_ANALYSIS_CONCURRENCY } from "@/lib/constants";
import type { AnalysisBatchResult } from "@/types/analysis";

export interface BulkDomainJob {
  domain: string;
  warmup: File;
}

export function useBulkAnalyses() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<PoolProgress | null>(null);

  const mutation = useMutation<AnalysisBatchResult, Error, BulkDomainJob[]>({
    mutationFn: async (jobs) => {
      setProgress({ done: 0, total: jobs.length });
      const settled = await runWithConcurrency(
        jobs,
        BULK_ANALYSIS_CONCURRENCY,
        (job) => createAnalysis({ domain: job.domain, warmup: { file: job.warmup, rows: null } }),
        setProgress,
      );
      return foldResults(jobs.map((j) => j.domain), settled);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: analysesKeys.history });
    },
    onSettled: () => setProgress(null),
  });

  return { ...mutation, progress };
}
