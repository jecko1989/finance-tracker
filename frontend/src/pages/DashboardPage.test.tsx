import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import type { Project } from "../types";
import { DashboardPage } from "./DashboardPage";

const projects: Project[] = [
  { id: 1, name: "Portafoglio personale", balance: "150.00", created_at: "2026-01-01T00:00:00" },
];

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "getProjects").mockResolvedValue(projects);
    vi.spyOn(api, "getRecentTransactions").mockResolvedValue([]);
  });

  it("lists existing projects with their balance", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Portafoglio personale")).toBeInTheDocument();
    expect(screen.getByText("150.00 €")).toBeInTheDocument();
  });

  it("creates a new project through the modal", async () => {
    vi.spyOn(api, "createProject").mockResolvedValue({
      id: 2,
      name: "Progetto B",
      balance: "0",
      created_at: "2026-01-02T00:00:00",
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Nuovo progetto"));
    fireEvent.change(screen.getByLabelText("Nome progetto"), { target: { value: "Progetto B" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith("Progetto B"));
  });

  it("does not delete the project if the confirmation is declined", async () => {
    vi.spyOn(api, "deleteProject").mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Elimina"));

    expect(window.confirm).toHaveBeenCalled();
    expect(api.deleteProject).not.toHaveBeenCalled();
  });

  it("deletes the project after the confirmation is accepted", async () => {
    vi.spyOn(api, "deleteProject").mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Elimina"));

    await waitFor(() => expect(api.deleteProject).toHaveBeenCalledWith(1));
  });
});
