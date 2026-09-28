import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the placeholder home route", () => {
    render(<App />);
    expect(screen.getByText("Finance Tracker")).toBeInTheDocument();
  });
});
