import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type Choice,
  ConfirmDialogProvider,
  useChoice,
  useConfirm,
} from "./confirm-dialog-provider";

// Captures the hooks so a test can open a dialog and inspect the answer.
let confirm: ReturnType<typeof useConfirm>;
let choose: ReturnType<typeof useChoice>;
function Probe() {
  confirm = useConfirm();
  choose = useChoice();
  return null;
}
const mount = () =>
  render(
    <ConfirmDialogProvider>
      <Probe />
    </ConfirmDialogProvider>,
  );

const series = {
  title: "Delete the whole series?",
  confirmText: "Whole series",
  alternativeText: "Just this one",
};

describe("confirm dialog", () => {
  it("offers a way out of a series choice, and says which button was pressed", async () => {
    mount();
    for (const [button, expected] of [
      ["Whole series", "confirm"],
      ["Just this one", "alternative"],
      ["Cancel", null],
    ] as const) {
      let answer: Promise<Choice>;
      act(() => {
        answer = choose(series);
      });
      fireEvent.click(await screen.findByRole("button", { name: button }));
      await expect(answer!).resolves.toBe(expected);
    }
  });

  it("settles as cancelled when dismissed with Escape, instead of waiting forever", async () => {
    mount();
    let answer: Promise<boolean>;
    act(() => {
      answer = confirm({ title: "Delete it?" });
    });
    fireEvent.keyDown(await screen.findByRole("alertdialog"), {
      key: "Escape",
    });
    await expect(answer!).resolves.toBe(false);
  });

  it("has no third button for a plain confirm", async () => {
    mount();
    act(() => {
      void confirm({ title: "Delete it?" });
    });
    await screen.findByRole("alertdialog");
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Cancel",
      "Confirm",
    ]);
  });
});
