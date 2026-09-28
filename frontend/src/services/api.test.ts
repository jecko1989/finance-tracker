import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, clearToken, getToken, login, setToken } from "./api";

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores and retrieves the token", () => {
    expect(getToken()).toBeNull();
    setToken("abc123");
    expect(getToken()).toBe("abc123");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("returns the access token on successful login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "tok" }), { status: 200 })),
    );

    const token = await login("admin", "admin");
    expect(token).toBe("tok");
  });

  it("throws ApiError with the backend detail message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: "Credenziali non valide" }), { status: 401 }),
        ),
    );

    await expect(login("admin", "wrong")).rejects.toThrow(ApiError);
  });
});
