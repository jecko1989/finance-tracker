import { Link } from "react-router-dom";
import type { Project } from "../types";

interface Props {
  project: Project;
  onRename: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onRename, onDelete }: Props) {
  const balance = Number(project.balance);
  const balanceColor = balance >= 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <Link to={`/projects/${project.id}`} className="text-lg font-semibold hover:underline">
        {project.name}
      </Link>
      <p className={`mt-2 text-2xl font-bold ${balanceColor}`}>{balance.toFixed(2)} €</p>
      <div className="mt-3 flex gap-2 text-sm">
        <button onClick={onRename} className="text-slate-500 hover:underline">
          Rinomina
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Eliminare "${project.name}" e tutte le sue transazioni?`)) {
              onDelete();
            }
          }}
          className="text-red-500 hover:underline"
        >
          Elimina
        </button>
      </div>
    </div>
  );
}
