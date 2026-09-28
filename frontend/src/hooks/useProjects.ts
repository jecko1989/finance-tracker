import { useCallback, useEffect, useState } from "react";
import * as api from "../services/api";
import type { Project } from "../types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await api.getProjects());
      setError(null);
    } catch {
      setError("Impossibile caricare i progetti");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProject = useCallback(
    async (name: string) => {
      await api.createProject(name);
      await refresh();
    },
    [refresh],
  );

  const renameProject = useCallback(
    async (id: number, name: string) => {
      await api.updateProject(id, name);
      await refresh();
    },
    [refresh],
  );

  const removeProject = useCallback(
    async (id: number) => {
      await api.deleteProject(id);
      await refresh();
    },
    [refresh],
  );

  return { projects, loading, error, createProject, renameProject, removeProject };
}
