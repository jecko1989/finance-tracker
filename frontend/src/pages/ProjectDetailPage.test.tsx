import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import type { ProjectSummary } from "../types";
import { ProjectDetailPage } from "./ProjectDetailPage";

const summary: ProjectSummary = {
  balance: "120.50",
  cumulative: [{ date: "2026-01-01", balance: "120.50" }],
  flow: [{ period: "2026-01", income: "200.00", expense: "79.50" }],
};

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
  });

  it("shows the current balance", async () => {
    renderPage();
    expect(await screen.findByText("120.50 €")).toBeInTheDocument();
  });

  it("shows an empty-state message when there is no chart data yet", async () => {
    vi.spyOn(api, "getProjectSummary").mockResolvedValue({ balance: "0", cumulative: [], flow: [] });
    renderPage();
    const messages = await screen.findAllByText("Nessun dato ancora da mostrare.");
    expect(messages).toHaveLength(2);
  });
});
