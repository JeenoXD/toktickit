import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChangePassword from "../../src/ChangePassword";
import { AuthProvider } from "../../src/AuthContext";
import * as api from "../../src/api";

beforeEach(() => {
  vi.restoreAllMocks();
});

function renderChangePassword() {
  render(
    <AuthProvider skipInitialCheck>
      <ChangePassword />
    </AuthProvider>
  );
}

it("renders the Update Password form with an explanation", () => {
  renderChangePassword();
  expect(screen.getByRole("heading", { name: "Update Password" })).toBeInTheDocument();
  expect(screen.getByText(/must set a new password/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
});

it("calls changePassword with the entered values on submit", async () => {
  const changePasswordMock = vi.spyOn(api, "changePassword").mockResolvedValue();
  vi.spyOn(api, "getMe").mockResolvedValue({
    id: 1, name: "Jennifer Anderson", email: "j@example.com", role: "REQUESTER", requiresPasswordChange: false,
  });

  renderChangePassword();
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "TempPass123!" } });
  fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "NewStrongPass1" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

  await waitFor(() => {
    expect(changePasswordMock).toHaveBeenCalledWith("TempPass123!", "NewStrongPass1");
  });
});

it("refreshes the authenticated user after a successful change", async () => {
  vi.spyOn(api, "changePassword").mockResolvedValue();
  const getMeMock = vi.spyOn(api, "getMe").mockResolvedValue({
    id: 1, name: "Jennifer Anderson", email: "j@example.com", role: "REQUESTER", requiresPasswordChange: false,
  });

  renderChangePassword();
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "TempPass123!" } });
  fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "NewStrongPass1" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

  await waitFor(() => expect(getMeMock).toHaveBeenCalled());
});

it("shows a busy state while the request is in flight", async () => {
  vi.spyOn(api, "changePassword").mockImplementation(
    () => new Promise((resolve) => setTimeout(resolve, 100))
  );
  vi.spyOn(api, "getMe").mockResolvedValue({
    id: 1, name: "Jennifer Anderson", email: "j@example.com", role: "REQUESTER", requiresPasswordChange: false,
  });

  renderChangePassword();
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "TempPass123!" } });
  fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "NewStrongPass1" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();
  });
  expect(screen.getByLabelText(/current password/i)).toBeDisabled();
  expect(screen.getByLabelText(/new password/i)).toBeDisabled();

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Update Password" })).not.toBeDisabled();
  }, { timeout: 500 });
});

it("shows the server's error message when the current password is wrong", async () => {
  vi.spyOn(api, "changePassword").mockRejectedValue(new Error("Current password is incorrect"));

  renderChangePassword();
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "WrongOne1!" } });
  fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "NewStrongPass1" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

  await waitFor(() => {
    expect(screen.getByText("Current password is incorrect")).toBeInTheDocument();
  });
});

it("shows the server's error message when the new password is too weak", async () => {
  vi.spyOn(api, "changePassword").mockRejectedValue(new Error("New password does not meet strength requirements"));

  renderChangePassword();
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "TempPass123!" } });
  fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "weak" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

  await waitFor(() => {
    expect(screen.getByText("New password does not meet strength requirements")).toBeInTheDocument();
  });
});

it("does not refresh the user when the change fails", async () => {
  vi.spyOn(api, "changePassword").mockRejectedValue(new Error("Current password is incorrect"));
  const getMeMock = vi.spyOn(api, "getMe");

  renderChangePassword();
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "WrongOne1!" } });
  fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "NewStrongPass1" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

  await waitFor(() => screen.getByText("Current password is incorrect"));
  expect(getMeMock).not.toHaveBeenCalled();
});