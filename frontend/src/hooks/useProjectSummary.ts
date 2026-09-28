import { useEffect, useState } from "react";
import * as api from "../services/api";
import type { ProjectSummary } from "../types";

export function useProjectSummary(projectId: number) {
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getProjectSummary(projectId)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [projectId]);

  return { summary, loading };
}
