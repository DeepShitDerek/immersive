import { describe, expect, it, vi } from "vitest";
import { corsHeaders, handlePublish, type PublishDeps } from "./logic";

const deps = (over: Partial<PublishDeps> = {}): PublishDeps => ({
  isOwner: vi.fn(async () => true),
  activeRuns: vi.fn(async () => 0),
  dispatch: vi.fn(async () => {}),
  latestRun: vi.fn(async () => ({
    status: "completed",
    conclusion: "success",
    createdAt: "2026-09-25T10:00:00Z",
    url: "https://github.com/x",
  })),
  ...over,
});

describe("publish site", () => {
  it("starts a deploy for the owner", async () => {
    const d = deps();
    expect(await handlePublish("POST", d)).toEqual({
      status: 202,
      body: { started: true },
    });
    expect(d.dispatch).toHaveBeenCalledOnce();
  });

  it("refuses anyone else, for status too, and dispatches nothing", async () => {
    const d = deps({ isOwner: vi.fn(async () => false) });
    expect((await handlePublish("POST", d)).status).toBe(403);
    expect((await handlePublish("GET", d)).status).toBe(403);
    expect(d.dispatch).not.toHaveBeenCalled();
    expect(d.latestRun).not.toHaveBeenCalled();
  });

  it("does not start a second build while one is running", async () => {
    const d = deps({ activeRuns: vi.fn(async () => 1) });
    const response = await handlePublish("POST", d);
    expect(response.status).toBe(409);
    expect(d.dispatch).not.toHaveBeenCalled();
  });

  it("reports the latest run, and rejects other methods", async () => {
    expect(await handlePublish("GET", deps())).toMatchObject({
      status: 200,
      body: { latest: { conclusion: "success" } },
    });
    expect((await handlePublish("DELETE", deps())).status).toBe(405);
  });

  it("lets only the admin's own origin call it from a browser, once configured", () => {
    expect(
      corsHeaders("https://me.dev", "https://me.dev")[
        "Access-Control-Allow-Origin"
      ],
    ).toBe("https://me.dev");
    expect(
      corsHeaders("https://me.dev", "https://evil.example")[
        "Access-Control-Allow-Origin"
      ],
    ).toBeUndefined();
    expect(
      corsHeaders(undefined, "http://localhost:3000")[
        "Access-Control-Allow-Origin"
      ],
    ).toBe("http://localhost:3000");
  });
});
