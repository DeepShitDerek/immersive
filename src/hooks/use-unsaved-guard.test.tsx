import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialogProvider } from "@/components/providers/confirm-dialog-provider";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const { useUnsavedGuard } = await import("./use-unsaved-guard");

function Page({ dirty }: { dirty: boolean }) {
  useUnsavedGuard(dirty);
  return (
    <>
      <a href="/admin/tasks">Tasks</a>
      <a href={`${window.location.pathname}?group=seo`}>SEO group</a>
    </>
  );
}
const mount = (dirty: boolean) =>
  render(
    <ConfirmDialogProvider>
      <Page dirty={dirty} />
    </ConfirmDialogProvider>,
  );

describe("leaving a page with unsaved changes", () => {
  it("asks before following a link to another page", async () => {
    push.mockClear();
    mount(true);
    const allowed = fireEvent.click(screen.getByText("Tasks"));
    expect(allowed).toBe(false); // default prevented
    fireEvent.click(await screen.findByRole("button", { name: "Stay" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Tasks"));
    fireEvent.click(await screen.findByRole("button", { name: "Leave" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/tasks"));
  });

  it("lets links within the same page, and clean pages, through", () => {
    mount(true);
    expect(fireEvent.click(screen.getByText("SEO group"))).toBe(true);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("does nothing when there is nothing unsaved", () => {
    mount(false);
    expect(fireEvent.click(screen.getByText("Tasks"))).toBe(true);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
