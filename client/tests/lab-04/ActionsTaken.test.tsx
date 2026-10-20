// UI-04, UI-05, UI-06 in docs/lab-04/tests.md
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionsTaken from "../../src/ActionsTaken";
import * as api from "../../src/api";
import type { ActionTaken } from "../../src/api";

const staff = [
  { id: 6, name: "IT Support Staff", role: "IT_STAFF" as const },
  { id: 7, name: "Carlos Mendez", role: "IT_STAFF" as const },
];

function action(overrides: Partial<ActionTaken> = {}): ActionTaken {
  return {
    id: 1,
    ticketId: 10,
    actionAt: "2026-10-20T03:00:00.000Z",
    description: "Checked the network cable",
    result: null,
    status: "PLANNED",
    performedBy: { id: 6, name: "IT Support Staff" },
    createdBy: { id: 6, name: "IT Support Staff" },
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    completedAt: null,
    cancelledAt: null,
    version: 1,
    createdAt: "2026-10-20T03:00:00.000Z",
    updatedAt: "2026-10-20T03:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "fetchStaffUsers").mockResolvedValue(staff);
});

describe("ActionsTaken (staff)", () => {
  it("lists actions in the order returned, with follow-up and attachment notes", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([
      action({ id: 1, description: "First action", status: "COMPLETED", result: "Fixed", followUpRequired: true, followUpNote: "Call back Monday", attachmentNotes: "See photo.png" }),
      action({ id: 2, description: "Second action", performedBy: { id: 7, name: "Carlos Mendez" } }),
    ]);
    render(<ActionsTaken ticketId={10} />);

    expect(await screen.findByRole("heading", { name: /Actions Taken \(2\)/ })).toBeInTheDocument();
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("First action");
    expect(rows[1]).toHaveTextContent("Second action");
    expect(rows[0]).toHaveTextContent("Completed");
    expect(rows[1]).toHaveTextContent("Carlos Mendez");
    expect(within(table).getByText("Call back Monday")).toBeInTheDocument();
    expect(within(table).getByText("See photo.png")).toBeInTheDocument();
  });

  it("shows an empty state for a ticket with no actions", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([]);
    render(<ActionsTaken ticketId={10} />);
    expect(await screen.findByText("No actions recorded yet.")).toBeInTheDocument();
  });

  it("shows a retry option when actions fail to load", async () => {
    const fetchSpy = vi.spyOn(api, "fetchActions").mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce([]);
    render(<ActionsTaken ticketId={10} />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No actions recorded yet.")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("creates a planned action with a performer and follow-up note", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValueOnce([]).mockResolvedValueOnce([action({ description: "Replace cable" })]);
    const createSpy = vi.spyOn(api, "createAction").mockResolvedValue(action({ description: "Replace cable" }));
    render(<ActionsTaken ticketId={10} />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add Action" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Replace cable");
    await userEvent.selectOptions(screen.getByLabelText("Performed by"), "7");
    expect(screen.queryByLabelText(/Follow-up Note/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Follow-up required"));
    await userEvent.type(screen.getByLabelText(/Follow-up Note/), "Check next week");
    await userEvent.type(screen.getByLabelText("Attachment Notes"), "cable.jpg");
    await userEvent.click(screen.getByRole("button", { name: "Save as Planned" }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    const [ticketId, payload] = createSpy.mock.calls[0];
    expect(ticketId).toBe(10);
    expect(payload).toMatchObject({
      description: "Replace cable",
      performedById: 7,
      followUpRequired: true,
      followUpNote: "Check next week",
      attachmentNotes: "cable.jpg",
    });
    expect(payload.clientRequestId).toBeTruthy();
    expect(await screen.findByText("Action saved.")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Replace cable")).toBeInTheDocument();
  });

  it("shows field errors and keeps entered data when follow-up note or description is missing", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([]);
    const createSpy = vi.spyOn(api, "createAction");
    render(<ActionsTaken ticketId={10} />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add Action" }));
    await userEvent.type(screen.getByLabelText("Attachment Notes"), "keep me");
    await userEvent.click(screen.getByLabelText("Follow-up required"));
    await userEvent.click(screen.getByRole("button", { name: "Save as Planned" }));

    expect(screen.getByText("Action description is required.")).toBeInTheDocument();
    expect(screen.getByText("Follow-up note is required when follow-up is needed.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Action Description/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Attachment Notes")).toHaveValue("keep me");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("shows server field errors and keeps the form filled", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([]);
    vi.spyOn(api, "createAction").mockRejectedValue(
      new api.ApiError("Please correct the highlighted fields.", 400, {
        error: "VALIDATION_ERROR",
        fields: { performedById: "Performed by must be an active user." },
      }),
    );
    render(<ActionsTaken ticketId={10} />);
    await userEvent.click(await screen.findByRole("button", { name: "+ Add Action" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Something");
    await userEvent.click(screen.getByRole("button", { name: "Save as Planned" }));

    expect(await screen.findByText("Performed by must be an active user.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Action Description/)).toHaveValue("Something");
  });

  it("Save and Complete requires a result, then creates and completes", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([]);
    const createSpy = vi.spyOn(api, "createAction").mockResolvedValue(action({ id: 5, version: 1 }));
    const statusSpy = vi.spyOn(api, "updateActionStatus").mockResolvedValue(action({ id: 5, status: "COMPLETED", version: 2 }));
    render(<ActionsTaken ticketId={10} />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add Action" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Reset password");
    await userEvent.click(screen.getByRole("button", { name: "Save and Complete" }));
    expect(screen.getByText("Result is required to complete an action.")).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Result"), "User can log in");
    await userEvent.click(screen.getByRole("button", { name: "Save and Complete" }));
    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith(10, 5, 1, "COMPLETED", "User can log in"));
  });

  it("edits a planned action with its version", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([action({ id: 3, version: 4, description: "Old text" })]);
    const updateSpy = vi.spyOn(api, "updateAction").mockResolvedValue(action({ id: 3, version: 5, description: "New text" }));
    render(<ActionsTaken ticketId={10} />);

    const table = await screen.findByRole("table");
    await userEvent.click(within(table).getByRole("button", { name: "Edit action: Old text" }));
    const desc = screen.getByLabelText(/Action Description/);
    expect(desc).toHaveValue("Old text");
    await userEvent.clear(desc);
    await userEvent.type(desc, "New text");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][0]).toBe(10);
    expect(updateSpy.mock.calls[0][1]).toBe(3);
    expect(updateSpy.mock.calls[0][2]).toBe(4);
    expect(updateSpy.mock.calls[0][3]).toMatchObject({ description: "New text", performedById: 6 });
  });

  it("completes and cancels a planned action", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([action({ id: 3, version: 2 })]);
    const statusSpy = vi.spyOn(api, "updateActionStatus").mockResolvedValue(action({ id: 3, status: "COMPLETED", version: 3 }));
    render(<ActionsTaken ticketId={10} />);

    const table = await screen.findByRole("table");
    await userEvent.click(within(table).getByRole("button", { name: /Complete action:/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm Complete" }));
    expect(screen.getByText("Result is required to complete an action.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Result"), "Done");
    await userEvent.click(screen.getByRole("button", { name: "Confirm Complete" }));
    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith(10, 3, 2, "COMPLETED", "Done"));

    await userEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: /Cancel action:/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm Cancel" }));
    await waitFor(() => expect(statusSpy).toHaveBeenLastCalledWith(10, 3, 2, "CANCELLED", undefined));
  });

  it("completed and cancelled actions have no edit controls", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([
      action({ id: 1, status: "COMPLETED", result: "ok", description: "Done one" }),
      action({ id: 2, status: "CANCELLED", description: "Dropped one" }),
    ]);
    render(<ActionsTaken ticketId={10} />);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /Edit action/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Complete action/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add Action" })).toBeInTheDocument();
  });

  it("UI-05: a double click sends only one create request", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([]);
    let resolve: (a: ActionTaken) => void = () => {};
    const createSpy = vi.spyOn(api, "createAction").mockImplementation(() => new Promise((r) => (resolve = r)));
    render(<ActionsTaken ticketId={10} />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add Action" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Once only");
    const save = screen.getByRole("button", { name: "Save as Planned" });
    await userEvent.dblClick(save);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    resolve(action());
    expect(await screen.findByText("Action saved.")).toBeInTheDocument();
  });

  it("UI-05: retrying after a network failure reuses the same clientRequestId", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([]);
    const createSpy = vi
      .spyOn(api, "createAction")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(action());
    render(<ActionsTaken ticketId={10} />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add Action" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Retry me");
    await userEvent.click(screen.getByRole("button", { name: "Save as Planned" }));
    expect(await screen.findByText(/Your entry is kept/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Action Description/)).toHaveValue("Retry me");

    await userEvent.click(screen.getByRole("button", { name: "Save as Planned" }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2));
    expect(createSpy.mock.calls[0][1].clientRequestId).toBe(createSpy.mock.calls[1][1].clientRequestId);
  });

  it("UI-05: a stale update shows a conflict message with Reload", async () => {
    const fetchSpy = vi.spyOn(api, "fetchActions").mockResolvedValue([action({ id: 3, description: "Shared action" })]);
    vi.spyOn(api, "updateAction").mockRejectedValue(
      new api.ApiError("stale", 409, { error: "STALE_UPDATE", current: action({ version: 2 }) }),
    );
    render(<ActionsTaken ticketId={10} />);

    await userEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Edit action: Shared action" }));
    await userEvent.type(screen.getByLabelText("Result"), "my edit");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText(/changed by someone else/)).toBeInTheDocument();
    expect(screen.getByLabelText("Result")).toHaveValue("my edit");
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("form", { name: "Edit action" })).not.toBeInTheDocument();
  });

  it("a locked ticket shows actions read only", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([action({ description: "Planned but locked" })]);
    render(<ActionsTaken ticketId={10} ticketLocked />);
    await screen.findByRole("table");
    expect(screen.getByText(/closed or cancelled/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Add Action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit action/ })).not.toBeInTheDocument();
  });
});

describe("ActionsTaken (requester, UI-06)", () => {
  it("is read only and does not load staff users", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([
      action({ status: "COMPLETED", description: "Replaced battery", result: "Holds charge" }),
      action({ id: 2, description: "Check again later" }),
    ]);
    const staffSpy = vi.spyOn(api, "fetchStaffUsers");
    render(<ActionsTaken ticketId={10} readOnly />);

    expect(await screen.findByRole("heading", { name: "Work done on this ticket" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Replaced battery")).toBeInTheDocument();
    expect(within(table).getByText("Check again later")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(staffSpy).not.toHaveBeenCalled();
  });

  it("shows a friendly empty state", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([]);
    render(<ActionsTaken ticketId={10} readOnly />);
    expect(await screen.findByText("IT Staff haven't recorded any actions yet.")).toBeInTheDocument();
  });
});

describe("ActionsTaken date default", () => {
  it("leaves an untouched Action Date/Time for the server to fill in, but sends an edited one", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([]);
    const createSpy = vi.spyOn(api, "createAction").mockResolvedValue(action());
    render(<ActionsTaken ticketId={10} />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add Action" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Default time");
    await userEvent.click(screen.getByRole("button", { name: "Save as Planned" }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0][1].actionAt).toBeUndefined();

    await userEvent.click(await screen.findByRole("button", { name: "+ Add Action" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Chosen time");
    const when = screen.getByLabelText("Action Date/Time");
    await userEvent.clear(when);
    await userEvent.type(when, "2026-10-21T09:30");
    await userEvent.click(screen.getByRole("button", { name: "Save as Planned" }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2));
    expect(createSpy.mock.calls[1][1].actionAt).toBe(new Date("2026-10-21T09:30").toISOString());
  });
});
