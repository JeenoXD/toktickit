import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const AUTHENTICATED_REQUESTER = {
  id: 1,
  name: "Jennifer Anderson",
  email: "j@example.com",
  role: "REQUESTER" as const,
  requiresPasswordChange: false,
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "getMe").mockResolvedValue(AUTHENTICATED_REQUESTER);
});

describe("App", () => {
  it("renders the TokTickIT heading once authenticated", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /TokTickIT/i })).toBeInTheDocument();
    });
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
      ],
    });

    render(<App />);
    await waitFor(() => screen.getByText("Check System"));
    fireEvent.click(screen.getByText("Check System"));

    await waitFor(() => {
      expect(screen.getByText(/Online/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Account and Access")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("Backend is unavailable"));

    render(<App />);
    await waitFor(() => screen.getByText("Check System"));
    fireEvent.click(screen.getByText("Check System"));

    await waitFor(() => {
      expect(screen.getByText(/Offline/i)).toBeInTheDocument();
    });
  });

  it("shows the login screen when not authenticated (UI route protection)", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(null);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    });
  });

  it("shows the change password screen and blocks the app when requiresPasswordChange is true", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue({ ...AUTHENTICATED_REQUESTER, requiresPasswordChange: true });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Update Password" })).toBeInTheDocument();
    });
    expect(screen.queryByText("TokTickIT")).not.toBeInTheDocument();
  });

  it("shows the authenticated user's name and role, and a Logout action", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
    });
    expect(screen.getByText("REQUESTER")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("logs out and returns to the login screen", async () => {
    vi.spyOn(api, "logout").mockResolvedValue();

    render(<App />);
    await waitFor(() => screen.getByText("Logout"));
    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    });
  });
});