import { useState } from "react";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { RecentTransactionsList } from "../components/RecentTransactionsList";
import { useProjects } from "../hooks/useProjects";
import { useRecentTransactions } from "../hooks/useRecentTransactions";
import type { Project } from "../types";

export function DashboardPage() {
  const { projects, loading, error, createProject, renameProject, removeProject } = useProjects();
  const { transactions } = useRecentTransactions();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Project | null>(null);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Progetti</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-white"
        >
          Nuovo progetto
        </button>
      </div>

      {loading && <p>Caricamento...</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
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
