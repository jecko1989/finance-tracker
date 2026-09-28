import { useEffect, useState } from "react";
import * as api from "../services/api";

export function useCategorySuggestions(projectId: number) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    api.suggestCategories(projectId).then(setSuggestions);
  }, [projectId]);

  return suggestions;
}
