import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  requestCreate,
  takeCreateIntent,
  useCreateIntent,
  type CreateTarget,
} from "./create-intent";

function Module({
  target,
  onCreate,
  ready = true,
}: {
  target: CreateTarget;
  onCreate: () => void;
  ready?: boolean;
}) {
  useCreateIntent(target, onCreate, ready);
  return null;
}

describe("quick add opens the create form", () => {
  it("navigates to the module, which opens its form once on arrival", () => {
    const navigate = vi.fn();
    requestCreate("task", navigate);
    expect(navigate).toHaveBeenCalledWith("/admin/tasks");
    const onCreate = vi.fn();
    const { rerender } = render(<Module target="task" onCreate={onCreate} />);
    rerender(<Module target="task" onCreate={onCreate} />);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("reaches a module already on screen", () => {
    const onCreate = vi.fn();
    render(<Module target="note" onCreate={onCreate} />);
    expect(onCreate).not.toHaveBeenCalled();
    act(() => requestCreate("note", () => {}));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("waits until the module is ready, and ignores other modules' requests", () => {
    const onCreate = vi.fn();
    const other = vi.fn();
    const { rerender } = render(
      <>
        <Module target="transaction" onCreate={onCreate} ready={false} />
        <Module target="post" onCreate={other} />
      </>,
    );
    act(() => requestCreate("transaction", () => {}));
    expect(onCreate).not.toHaveBeenCalled();
    rerender(
      <>
        <Module target="transaction" onCreate={onCreate} ready />
        <Module target="post" onCreate={other} />
      </>,
    );
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it("lapses, so a later visit does not open a form out of nowhere", () => {
    requestCreate("transaction", () => {}, 0);
    expect(takeCreateIntent("transaction", 60_000)).toBe(false);
  });
});
