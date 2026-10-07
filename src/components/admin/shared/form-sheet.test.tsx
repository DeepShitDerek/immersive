import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialogProvider } from "@/components/providers/confirm-dialog-provider";
import FormSheet from "./form-sheet";

function setup() {
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialogProvider>
      <FormSheet open onOpenChange={onOpenChange} title="New habit">
        <input aria-label="Name" />
      </FormSheet>
    </ConfirmDialogProvider>,
  );
  return { onOpenChange };
}

const escape = () =>
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

describe("form sheets ask before dropping input", () => {
  it("closes at once when nothing was entered", () => {
    const { onOpenChange } = setup();
    escape();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks when something was typed, and stays open to keep editing", async () => {
    const { onOpenChange } = setup();
    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Read" },
    });
    escape();
    fireEvent.click(
      await screen.findByRole("button", { name: "Keep editing" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("still asks after a submit that failed validation", async () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialogProvider>
        <FormSheet open onOpenChange={onOpenChange} title="New transaction">
          <form onSubmit={(e) => e.preventDefault()}>
            <input aria-label="Name" />
          </form>
        </FormSheet>
      </ConfirmDialogProvider>,
    );
    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Rent" },
    });
    fireEvent.submit(screen.getByLabelText("Name").closest("form")!);
    escape();
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes at once when the sheet says nothing is unsaved", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialogProvider>
        <FormSheet
          open
          onOpenChange={onOpenChange}
          title="Check account"
          dirty={false}
        >
          <input aria-label="Balance" />
        </FormSheet>
      </ConfirmDialogProvider>,
    );
    fireEvent.input(screen.getByLabelText("Balance"), {
      target: { value: "12" },
    });
    escape();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes once the changes are discarded", async () => {
    const { onOpenChange } = setup();
    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Read" },
    });
    escape();
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
