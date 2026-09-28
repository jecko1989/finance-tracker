import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import type { ProjectSummary, Transaction } from "../types";
import { ProjectDetailPage } from "./ProjectDetailPage";

const summary: ProjectSummary = {
  balance: "120.50",
  cumulative: [{ date: "2026-01-01", balance: "120.50" }],
  flow: [{ period: "2026-01", income: "200.00", expense: "79.50" }],
};

const transactions: Transaction[] = [
  {
    id: 1,
    project_id: 1,
    amount: "45.00",
    date: "2026-01-01",
    note: "Stipendio",
    category: "reddito",
    created_at: "2026-01-01T00:00:00",
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "getProjectSummary").mockResolvedValue(summary);
    vi.spyOn(api, "getTransactions").mockResolvedValue(transactions);
    vi.spyOn(api, "suggestCategories").mockResolvedValue(["reddito", "affitto"]);
  });

  it("shows the current balance and the transaction list", async () => {
    renderPage();
    expect(await screen.findByText("120.50 €")).toBeInTheDocument();
    expect(await screen.findByText("Stipendio")).toBeInTheDocument();
  });

  it("shows an empty-state message when there is no chart data yet", async () => {
    vi.spyOn(api, "getProjectSummary").mockResolvedValue({ balance: "0", cumulative: [], flow: [] });
    vi.spyOn(api, "getTransactions").mockResolvedValue([]);
    renderPage();
    const chartMessages = await screen.findAllByText("Nessun dato ancora da mostrare.");
    expect(chartMessages).toHaveLength(2);
    expect(await screen.findByText("Nessuna transazione in questo periodo.")).toBeInTheDocument();
  });

  it("submits a negative amount when 'Uscita' is selected", async () => {
    vi.spyOn(api, "createTransaction").mockResolvedValue(transactions[0]);
    renderPage();

    fireEvent.click(await screen.findByText("Nuova transazione"));
    fireEvent.click(screen.getByText("Uscita"));
    fireEvent.change(screen.getByLabelText("Importo"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-02-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ amount: -50, date: "2026-02-01" }),
      ),
    );
  });

  it("deletes a transaction after the confirmation is accepted", async () => {
    vi.spyOn(api, "deleteTransaction").mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(await screen.findByText("Elimina"));

    await waitFor(() => expect(api.deleteTransaction).toHaveBeenCalledWith(1, 1));
  });

  it("does not delete a transaction if the confirmation is declined", async () => {
    vi.spyOn(api, "deleteTransaction").mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();

    fireEvent.click(await screen.findByText("Elimina"));

    expect(window.confirm).toHaveBeenCalled();
    expect(api.deleteTransaction).not.toHaveBeenCalled();
  });
});
