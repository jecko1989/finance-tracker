import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../context/ThemeContext";
import * as api from "../services/api";
import { Layout } from "./Layout";

function renderLayout() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<div>Contenuto</div>} />
          </Route>
          <Route path="/login" element={<div>Pagina di login</div>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("Layout", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("logs out from the user menu and returns to the login page", async () => {
    api.setToken("abc");
    renderLayout();

    fireEvent.click(screen.getByLabelText("Menu utente"));
    fireEvent.click(screen.getByText(/Esci/));

    expect(await screen.findByText("Pagina di login")).toBeInTheDocument();
    expect(api.getToken()).toBeNull();
  });

  it("opens the change password modal from the user menu", () => {
    renderLayout();
    fireEvent.click(screen.getByLabelText("Menu utente"));
    fireEvent.click(screen.getByText(/Cambia password/));
    expect(screen.getByLabelText("Password attuale")).toBeInTheDocument();
  });

  it("toggles dark mode and persists the choice", () => {
    renderLayout();
    const toggle = screen.getAllByLabelText("Passa al tema scuro")[0];
    fireEvent.click(toggle);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(screen.getAllByLabelText("Passa al tema chiaro")[0]);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
