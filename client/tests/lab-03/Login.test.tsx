import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "../../src/Login";
import { AuthProvider } from "../../src/AuthContext";
import * as api from "../../src/api";

beforeEach(() => {
  vi.restoreAllMocks();
});

function renderLogin() {
  render(
    <AuthProvider skipInitialCheck>
      <Login />
    </AuthProvider>
  );
}

it("renders the Sign In form", () => {
  renderLogin();
  expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

it("marks email and password as required fields", () => {
  renderLogin();
  expect(screen.getByLabelText(/email/i)).toBeRequired();
  expect(screen.getByLabelText(/password/i)).toBeRequired();
});

it("calls login with the entered credentials on submit", async () => {
  const loginMock = vi.spyOn(api, "login").mockResolvedValue({
    id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com",
    role: "REQUESTER", requiresPasswordChange: false,
  });

  renderLogin();
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jennifer.anderson@example.com" } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "TempPass123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

  await waitFor(() => {
    expect(loginMock).toHaveBeenCalledWith("jennifer.anderson@example.com", "TempPass123!");
  });
});

it("disables the form and shows a busy label while signing in", async () => {
  vi.spyOn(api, "login").mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve({
      id: 1, name: "Jennifer Anderson", email: "j@example.com", role: "REQUESTER", requiresPasswordChange: false,
    }), 100))
  );

  renderLogin();
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "j@example.com" } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "TempPass123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  });
  expect(screen.getByLabelText(/email/i)).toBeDisabled();
  expect(screen.getByLabelText(/password/i)).toBeDisabled();
});

it("shows a safe, generic error message on invalid credentials", async () => {
  vi.spyOn(api, "login").mockRejectedValue(new Error("Invalid email or password"));

  renderLogin();
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "wrong@example.com" } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "WrongPass1!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

  await waitFor(() => {
    expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: "Sign In" })).not.toBeDisabled();
});

it("shows the same generic error for an inactive account as for a wrong password", async () => {
  // Matches server behavior: INVALID_CREDENTIALS message is identical either way.
  vi.spyOn(api, "login").mockRejectedValue(new Error("Invalid email or password"));

  renderLogin();
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "inactive.user@example.com" } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "TempPass123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

  await waitFor(() => {
    expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
  });
  expect(screen.queryByText(/inactive/i)).not.toBeInTheDocument();
});

it("clears a previous error on a new submit attempt", async () => {
  const loginMock = vi.spyOn(api, "login")
    .mockRejectedValueOnce(new Error("Invalid email or password"))
    .mockResolvedValueOnce({
      id: 1, name: "Jennifer Anderson", email: "j@example.com", role: "REQUESTER", requiresPasswordChange: false,
    });

  renderLogin();
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "j@example.com" } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "WrongPass1!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  await waitFor(() => screen.getByText("Invalid email or password"));

  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "TempPass123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

  await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
});