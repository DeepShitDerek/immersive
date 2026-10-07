import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { PublishSiteButton, describeRun } = await import(
  "./publish-site-button"
);

const run = (status: string, conclusion: string | null, createdAt: string) => ({
  status,
  conclusion,
  createdAt,
  url: "https://github.com/run",
});

beforeEach(() => invoke.mockReset());

describe("publish site button", () => {
  it("describes the last run", () => {
    const now = new Date("2026-09-25T12:10:00Z").getTime();
    expect(describeRun(null, now)).toBe("Not published from here yet.");
    expect(
      describeRun(run("in_progress", null, "2026-09-25T12:08:00Z"), now),
    ).toMatch(/^Publishing/);
    expect(
      describeRun(run("completed", "success", "2026-09-25T12:05:00Z"), now),
    ).toBe("Last published 5 min ago.");
    expect(
      describeRun(run("completed", "failure", "2026-09-25T12:09:40Z"), now),
    ).toBe("The last publish failed (just now).");
  });

  it("says publishing is not set up, rather than offering a button that cannot work", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: { status: 404, json: async () => ({}) } },
    });
    render(<PublishSiteButton />);
    expect(
      await screen.findByText(/once the publish-site function is set up/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish site" })).toBeNull();
  });

  it("starts a publish when set up", async () => {
    invoke.mockImplementation(
      async (_fn: string, options?: { method?: string }) =>
        options?.method !== "POST"
          ? {
              data: {
                latest: run("completed", "success", new Date().toISOString()),
              },
              error: null,
            }
          : { data: { started: true }, error: null },
    );
    render(<PublishSiteButton />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Publish site" }),
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("publish-site", { method: "POST" }),
    );
  });
});
