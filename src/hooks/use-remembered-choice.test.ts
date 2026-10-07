import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useRememberedChoice } from "./use-remembered-choice";

const VIEWS = ["board", "list"] as const;

beforeEach(() => localStorage.clear());

describe("remembered view choice", () => {
  it("comes back on the next visit", () => {
    const first = renderHook(() =>
      useRememberedChoice("tasks", "board", VIEWS),
    );
    act(() => first.result.current[1]("list"));
    first.unmount();
    const second = renderHook(() =>
      useRememberedChoice("tasks", "board", VIEWS),
    );
    expect(second.result.current[0]).toBe("list");
  });

  it("ignores a stored value that is no longer an option", () => {
    localStorage.setItem("admin-view:tasks", "gantt");
    const { result } = renderHook(() =>
      useRememberedChoice("tasks", "board", VIEWS),
    );
    expect(result.current[0]).toBe("board");
  });
});
