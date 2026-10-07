import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Options = {
  action: { onClick: () => void };
  onAutoClose: () => void;
  onDismiss: () => void;
};
const shown: Options[] = [];
vi.mock("sonner", () => ({
  toast: (_title: string, options: Options) => {
    shown.push(options);
  },
}));

import { useUndoableDelete } from "./use-undoable-delete";

const item = { id: "a" };

describe("useUndoableDelete", () => {
  beforeEach(() => {
    shown.length = 0;
  });

  it("hides the item at once and deletes nothing until the toast closes", async () => {
    const commit = vi.fn(async () => {});
    const { result } = renderHook(() => useUndoableDelete(commit));
    act(() => result.current.remove(item, "Deleted"));
    expect(result.current.pending.has("a")).toBe(true);
    expect(commit).not.toHaveBeenCalled();

    await act(async () => shown[0].onAutoClose());
    expect(commit).toHaveBeenCalledWith(item);
    expect(result.current.pending.has("a")).toBe(false);
  });

  it("Undo brings it back and never deletes, even as the toast is dismissed", async () => {
    const commit = vi.fn(async () => {});
    const { result } = renderHook(() => useUndoableDelete(commit));
    act(() => result.current.remove(item, "Deleted"));
    await act(async () => {
      shown[0].action.onClick();
      shown[0].onDismiss();
    });
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.pending.has("a")).toBe(false);
  });

  it("commits what is pending when the page goes away", () => {
    const commit = vi.fn(async () => {});
    const { result, unmount } = renderHook(() => useUndoableDelete(commit));
    act(() => result.current.remove(item, "Deleted"));
    unmount();
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
