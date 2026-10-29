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

const AUTHENTICATED_ADMIN = {
  id: 10,
  name: "System Admin",
  email: "admin@example.com",
  role: "ADMINISTRATOR" as const,
  requiresPasswordChange: false,
};

// Lab 4: the dashboard is the landing view, and the Lab 1 health check now lives
// in the "System status" card on the Administrator dashboard.
const EMPTY_STAFF_DASHBOARD = {
  metrics: {
    unassigned: { count: 0, drillDown: { view: "ticketQueue" as const, filters: {} } },
    myAssigned: { count: 0, drillDown: { view: "ticketQueue" as const, filters: {} } },
    waitingForRequester: { count: 0, drillDown: { view: "ticketQueue" as const, filters: {} } },
    appearsResolved: { count: 0, drillDown: { view: "ticketQueue" as const, filters: {} } },
    myPlannedActions: { count: 0, items: [] },
    myFollowUps: { count: 0, items: [] },
  },
  byStatus: { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 },
  byItPriority: { HIGH: 0, MEDIUM: 0, LOW: 0, UNSET: 0 },
  urgent: [],
  recentlyUpdated: [],
  users: { active: { REQUESTER: 0, IT_STAFF: 0, ADMINISTRATOR: 1 }, inactive: 0 },
  generatedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "getMe").mockResolvedValue(AUTHENTICATED_REQUESTER);
  vi.spyOn(api, "fetchRequesterDashboard").mockRejectedValue(new Error("not needed in these tests"));
  vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(EMPTY_STAFF_DASHBOARD);
});

describe("App", () => {
  it("renders the TokTickIT heading once authenticated", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /TokTickIT/i })).toBeInTheDocument();
    });
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(AUTHENTICATED_ADMIN);
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
    vi.spyOn(api, "getMe").mockResolvedValue(AUTHENTICATED_ADMIN);
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
    // Lab 4: the role badge shows a readable label instead of the raw code.
    expect(screen.getByText("Requester")).toBeInTheDocument();
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