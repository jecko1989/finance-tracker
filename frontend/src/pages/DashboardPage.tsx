import { useState } from "react";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { RecentTransactionsList } from "../components/RecentTransactionsList";
import { useProjects } from "../hooks/useProjects";
import { useRecentTransactions } from "../hooks/useRecentTransactions";
import { btnPrimary, errorBox } from "../styles";
import type { Project } from "../types";

export function DashboardPage() {
  const { projects, loading, error, createProject, renameProject, removeProject } = useProjects();
  const { transactions } = useRecentTransactions();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Project | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Progetti</h1>
        <button onClick={() => setCreating(true)} className={btnPrimary}>
          Nuovo progetto
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Caricamento...</p>}
      {error && <p className={`mb-3 ${errorBox}`}>{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onRename={() => setRenaming(project)}
            onDelete={() => removeProject(project.id)}
          />
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Ultime transazioni</h2>
      <RecentTransactionsList transactions={transactions} />

      {creating && (
        <ProjectFormModal
          title="Nuovo progetto"
          onSubmit={createProject}
          onClose={() => setCreating(false)}
        />
      )}
      {renaming && (
        <ProjectFormModal
          title="Rinomina progetto"
          initialName={renaming.name}
          onSubmit={(name) => renameProject(renaming.id, name)}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  );
}
