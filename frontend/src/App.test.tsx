import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("redirects an unauthenticated visitor to the login page", () => {
    localStorage.clear();
    render(<App />);
    expect(screen.getByLabelText("Utente")).toBeInTheDocument();
  });
});
