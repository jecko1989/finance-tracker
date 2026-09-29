import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { ChangePasswordModal } from "./ChangePasswordModal";

function fill(old: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Password attuale"), { target: { value: old } });
  fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Conferma nuova password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Salva" }));
}

describe("ChangePasswordModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects mismatched passwords without calling the API", async () => {
    const spy = vi.spyOn(api, "changePassword").mockResolvedValue();
    render(<ChangePasswordModal onClose={() => {}} />);
    fill("old", "newpass1", "different");
    expect(await screen.findByText("Le password non coincidono")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("shows success after a valid change", async () => {
    const spy = vi.spyOn(api, "changePassword").mockResolvedValue();
    render(<ChangePasswordModal onClose={() => {}} />);
    fill("old", "newpass1", "newpass1");
    await waitFor(() => expect(spy).toHaveBeenCalledWith("old", "newpass1"));
    expect(await screen.findByText("Password cambiata con successo")).toBeInTheDocument();
  });

  it("shows the server error", async () => {
    vi.spyOn(api, "changePassword").mockRejectedValue(new api.ApiError(400, "Password attuale non corretta"));
    render(<ChangePasswordModal onClose={() => {}} />);
    fill("bad", "newpass1", "newpass1");
    expect(await screen.findByText("Password attuale non corretta")).toBeInTheDocument();
  });
});
