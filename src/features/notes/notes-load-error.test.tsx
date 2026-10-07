import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// A failed read of the notes list.
const refetch = vi.fn();
const mutation = () => [vi.fn(), { isLoading: false }];
vi.mock("@/store/api/adminApi", () => ({
  useGetNotesQuery: () => ({
    data: undefined,
    isLoading: false,
    error: { message: "JWT expired" },
    refetch,
  }),
  useAddNoteMutation: mutation,
  useUpdateNoteMutation: mutation,
  useArchiveNoteMutation: mutation,
  useDeleteNoteMutation: mutation,
}));
vi.mock("@/hooks/use-url-param", () => ({
  useUrlParam: () => [null, vi.fn()],
}));
vi.mock("@/components/providers/confirm-dialog-provider", () => ({
  useConfirm: () => vi.fn(),
}));
vi.mock("@/components/admin/novel-editor/load-editor", () => ({
  loadNovelEditor: () => Promise.resolve(),
}));

const { default: NotesPage } = await import("./notes-page");

describe("a module whose data failed to load", () => {
  it('says so, with the reason and a retry — not "No notes yet"', () => {
    render(<NotesPage />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't load your notes.",
    );
    expect(screen.getByText("JWT expired")).toBeTruthy();
    expect(screen.queryByText("No notes yet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });
});
