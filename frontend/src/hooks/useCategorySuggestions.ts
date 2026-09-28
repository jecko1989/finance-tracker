import { useCallback, useEffect, useState } from "react";
import * as api from "../services/api";

export function useCategorySuggestions(projectId: number) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const refresh = useCallback(() => {
    return api.suggestCategories(projectId).then(setSuggestions);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { suggestions, refresh };
}
