import { beforeEach, describe, expect, it } from "vitest";
import type { BlogPost } from "@/types";
import { draftFromPost } from "./post-draft";
import {
  clearRecovery,
  keepRecovery,
  readRecovery,
  recoveryKey,
} from "./post-recovery";

const post = {
  id: "p1",
  title: "Live post",
  slug: "live-post",
  content: "Body",
  published: true,
} as BlogPost;

beforeEach(() => localStorage.clear());

describe("blog editor recovery", () => {
  it("keys a copy by post, and new posts share one slot", () => {
    expect(recoveryKey(post)).toBe("blog-editor-recovery:p1");
    expect(recoveryKey(null)).toBe("blog-editor-recovery:new");
  });

  it("offers back edits that differ from the post as saved", () => {
    const edited = { ...draftFromPost(post), content: "Body, rewritten" };
    keepRecovery(recoveryKey(post), edited, new Date("2026-09-25T10:00:00Z"));
    expect(readRecovery(post)).toEqual({
      draft: edited,
      at: "2026-09-25T10:00:00.000Z",
    });
  });

  it("drops a copy that matches what is saved now (the post was updated elsewhere)", () => {
    keepRecovery(recoveryKey(post), draftFromPost(post));
    expect(readRecovery(post)).toBeNull();
    expect(localStorage.getItem(recoveryKey(post))).toBeNull();
  });

  it("survives a copy from an older shape and ignores garbage", () => {
    localStorage.setItem(
      recoveryKey(post),
      JSON.stringify({
        draft: { content: "Only content" },
        at: "2026-09-25T10:00:00Z",
      }),
    );
    expect(readRecovery(post)?.draft).toMatchObject({
      title: "Live post",
      content: "Only content",
    });
    localStorage.setItem(recoveryKey(post), "not json");
    expect(readRecovery(post)).toBeNull();
    localStorage.setItem(recoveryKey(post), JSON.stringify({ nope: true }));
    expect(readRecovery(post)).toBeNull();
  });

  it("clears a copy", () => {
    keepRecovery(recoveryKey(post), { ...draftFromPost(post), title: "x" });
    clearRecovery(recoveryKey(post));
    expect(readRecovery(post)).toBeNull();
  });
});
