import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReadingForm from "./ReadingForm.jsx";

const apiMocks = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock("../api/client.js", () => ({ api: apiMocks }));

const selectedDate = "2026-10-15";
const validationErrors = [
  ["value", "Value must be between 40 and 600 mg/dl."],
  ["slot", "You already have an After breakfast reading for this date."],
  ["date", "You can add only 4 readings per day."],
  ["date", "Date cannot be in the future."],
];

function renderForm(props = {}) {
  const onCancel = vi.fn();
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(
    <ReadingForm
      selectedDate={selectedDate}
      onCancel={onCancel}
      onSaved={onSaved}
      {...props}
    />,
  );
  return { onCancel, onSaved };
}

async function submitValidForm(user) {
  await user.selectOptions(screen.getByLabelText("Time slot"), "AFTER_BREAKFAST");
  await user.type(screen.getByLabelText("Glucose value (mg/dl)"), "120");
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("ReadingForm", () => {
  beforeEach(() => {
    apiMocks.post.mockReset().mockResolvedValue({ data: {} });
    apiMocks.put.mockReset().mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders date, all labelled slots, value, and Save", () => {
    renderForm();

    expect(screen.getByLabelText("Reading date")).toHaveValue(selectedDate);
    expect(screen.getByLabelText("Time slot")).toBeVisible();
    expect(screen.getByRole("option", { name: "Morning (fasting)" })).toBeVisible();
    expect(screen.getByRole("option", { name: "After breakfast" })).toBeVisible();
    expect(screen.getByRole("option", { name: "After lunch" })).toBeVisible();
    expect(screen.getByRole("option", { name: "After dinner" })).toBeVisible();
    expect(screen.getByLabelText("Glucose value (mg/dl)")).toHaveAttribute("type", "number");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows the required-value message without sending an empty value", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please enter a glucose value.",
    );
    expect(apiMocks.post).not.toHaveBeenCalled();
  });

  it.each(validationErrors)(
    "shows the server validation error for %s",
    async (field, message) => {
      const user = userEvent.setup();
      apiMocks.post.mockRejectedValue({
        response: { data: { error: { field, message } } },
      });
      renderForm();

      await user.selectOptions(
        screen.getByLabelText("Time slot"),
        "AFTER_BREAKFAST",
      );
      await user.type(
        screen.getByLabelText("Glucose value (mg/dl)"),
        field === "value" ? "700" : "120",
      );
      if (message === "Date cannot be in the future.") {
        await user.clear(screen.getByLabelText("Reading date"));
        await user.type(screen.getByLabelText("Reading date"), "2099-12-31");
      }
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(apiMocks.post).toHaveBeenCalledWith(
        "/readings",
        expect.objectContaining({
          value: field === "value" ? "700" : "120",
        }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.getByText(message, { selector: ".field-error" })).toBeVisible();
    },
  );

  it("submits a valid payload and clears the form after success", async () => {
    const user = userEvent.setup();
    const { onCancel, onSaved } = renderForm();

    await submitValidForm(user);

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith(
      "/readings",
      { date: selectedDate, slot: "AFTER_BREAKFAST", value: "120" },
    ));
    expect(await screen.findByLabelText("Glucose value (mg/dl)")).toHaveValue(null);
    expect(screen.getByLabelText("Time slot")).toHaveValue("");
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("disables Save while the request is pending", async () => {
    const user = userEvent.setup();
    let resolveRequest;
    apiMocks.post.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    renderForm();

    await user.selectOptions(screen.getByLabelText("Time slot"), "AFTER_BREAKFAST");
    await user.type(screen.getByLabelText("Glucose value (mg/dl)"), "120");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    resolveRequest({ data: {} });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });

  it("pre-fills edit mode and calls the update endpoint", async () => {
    const user = userEvent.setup();
    const editingReading = {
      id: 17,
      date: selectedDate,
      slot: "AFTER_LUNCH",
      value: 142,
      slotLabel: "After lunch",
    };
    const { onSaved } = renderForm({ reading: editingReading });

    expect(screen.getByRole("heading", { name: "Edit reading" })).toBeVisible();
    expect(screen.getByLabelText("Reading date")).toHaveValue(selectedDate);
    expect(screen.getByLabelText("Time slot")).toHaveValue("AFTER_LUNCH");
    expect(screen.getByLabelText("Glucose value (mg/dl)")).toHaveValue(142);

    await user.clear(screen.getByLabelText("Glucose value (mg/dl)"));
    await user.type(screen.getByLabelText("Glucose value (mg/dl)"), "155");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiMocks.put).toHaveBeenCalledWith(
      "/readings/17",
      { date: selectedDate, slot: "AFTER_LUNCH", value: "155" },
    ));
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
