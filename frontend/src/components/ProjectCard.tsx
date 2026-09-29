import { Link } from "react-router-dom";
import { cardClass, negativeText, positiveText } from "../styles";
import type { Project } from "../types";

interface Props {
  project: Project;
  onRename: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onRename, onDelete }: Props) {
  const balance = Number(project.balance);
  const balanceColor = balance >= 0 ? positiveText : negativeText;

  return (
    <div className={`p-4 transition hover:shadow-md ${cardClass}`}>
      <Link to={`/projects/${project.id}`} className="text-lg font-semibold text-gray-900 hover:underline dark:text-gray-100">
        {project.name}
      </Link>
      <p className={`mt-2 text-2xl font-bold ${balanceColor}`}>{balance.toFixed(2)} €</p>
      <div className="mt-3 flex gap-2 text-sm">
        <button onClick={onRename} className="text-gray-500 hover:underline dark:text-gray-400">
          Rinomina
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Eliminare "${project.name}" e tutte le sue transazioni?`)) {
              onDelete();
            }
          }}
          className="text-red-500 hover:underline dark:text-red-400"
        >
          Elimina
        </button>
      </div>
    </div>
  );
}
