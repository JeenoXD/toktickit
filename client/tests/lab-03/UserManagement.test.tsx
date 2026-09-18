import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserManagement from "../../src/UserManagement";
import * as api from "../../src/api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Admin user management", () => {
  it("renders the admin user table with search and role filters", async () => {
    vi.spyOn(api, "fetchUsers").mockResolvedValue([
      { id: 1, name: "Alice Admin", email: "alice@example.com", role: "ADMINISTRATOR", isActive: true },
      { id: 2, name: "Bob Support", email: "bob@example.com", role: "IT_STAFF", isActive: true },
    ]);

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /user management/i })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role filter/i)).toBeInTheDocument();
    expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("Bob Support")).toBeInTheDocument();
  });

  it("validates duplicate email and invalid inputs during create user", async () => {
    vi.spyOn(api, "fetchUsers").mockResolvedValue([]);
    vi.spyOn(api, "createUser").mockRejectedValueOnce(new Error("A user with this email already exists."));

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create user/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /create user/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Duplicate User" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "dup@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Role$/i), { target: { value: "REQUESTER" } });
    fireEvent.change(screen.getByLabelText(/initial password/i), { target: { value: "TempPass123!" } });
    fireEvent.click(screen.getByRole("button", { name: /save user/i }));

    await waitFor(() => {
      expect(screen.getByText("A user with this email already exists.")).toBeInTheDocument();
    });
  });

  it("allows resetting a password for a selected user", async () => {
    vi.spyOn(api, "fetchUsers").mockResolvedValue([
      { id: 3, name: "Charlie User", email: "charlie@example.com", role: "REQUESTER", isActive: true },
    ]);
    vi.spyOn(api, "resetUserPassword").mockResolvedValue({ message: "Password reset successfully", requiresPasswordChange: true });

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText("Charlie User")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "NewStrongPass1" } });
    fireEvent.click(screen.getByRole("button", { name: /save password/i }));

    await waitFor(() => {
      expect(api.resetUserPassword).toHaveBeenCalledWith(3, "NewStrongPass1");
    });
  });
});
