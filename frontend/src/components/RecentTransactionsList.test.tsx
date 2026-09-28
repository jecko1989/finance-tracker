import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { RecentTransaction } from "../types";
import { RecentTransactionsList } from "./RecentTransactionsList";

describe("RecentTransactionsList", () => {
  it("shows an empty-state message when there are no transactions", () => {
    render(
      <MemoryRouter>
        <RecentTransactionsList transactions={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Nessuna transazione registrata.")).toBeInTheDocument();
  });

  it("renders each transaction with its project name and formatted amount", () => {
    const transactions: RecentTransaction[] = [
      {
        id: 1,
        project_id: 5,
        project_name: "Progetto B",
        amount: "-42.50",
        date: "2026-01-15",
        note: "Bolletta luce",
        category: "utenze",
      },
    ];

    render(
      <MemoryRouter>
        <RecentTransactionsList transactions={transactions} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Progetto B")).toBeInTheDocument();
    expect(screen.getByText("Bolletta luce")).toBeInTheDocument();
    expect(screen.getByText("-42.50 €")).toBeInTheDocument();
  });
});
