`AnalysisOut.model_validate(analysis)` serializes the completed row (scores, verdict, cache flags) back to the client as HTTP 201. The frontend's `useAnalyses` mutation then renders the report.
