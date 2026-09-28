import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("logs in with the entered credentials on submit", async () => {
    vi.spyOn(api, "login").mockResolvedValue("tok123");

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Utente"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));

    await waitFor(() => expect(api.login).toHaveBeenCalledWith("admin", "admin"));
  });

  it("shows an error message on failed login", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("nope"));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Utente"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));

    await waitFor(() => expect(screen.getByText("Credenziali non valide")).toBeInTheDocument());
  });
});
