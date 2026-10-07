import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BlogPost } from "@/types";
import { PostRow } from "./post-list";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const post = (published: boolean) =>
  ({
    id: "p1",
    title: "RAG lessons",
    slug: "rag-lessons",
    excerpt: "What mattered",
    published,
    published_at: published ? "2026-10-01T00:00:00Z" : null,
    updated_at: "2026-10-02T00:00:00Z",
    views: published ? 1234 : undefined,
    tags: [],
  }) as unknown as BlogPost;

const mount = (published: boolean, onToggleStatus = vi.fn()) =>
  render(
    <ul>
      <PostRow
        post={post(published)}
        onEdit={vi.fn()}
        onToggleStatus={onToggleStatus}
        onDelete={vi.fn()}
      />
    </ul>,
  );

describe("post row", () => {
  it("says Draft or Published in words", () => {
    const { unmount } = mount(false);
    expect(screen.getByText("Draft")).toBeTruthy();
    unmount();
    mount(true);
    expect(screen.getByText("Published")).toBeTruthy();
  });

  it("offers Publish on the row at every width, with its name spoken", () => {
    const onToggleStatus = vi.fn();
    mount(false, onToggleStatus);
    fireEvent.click(
      screen.getByRole("button", { name: "Publish RAG lessons" }),
    );
    expect(onToggleStatus).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "More actions for RAG lessons" }),
    ).toBeTruthy();
  });
});
