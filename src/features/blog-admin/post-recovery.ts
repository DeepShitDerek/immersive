import type { BlogPost } from "@/types";
import { draftFromPost, type PostDraft, sameDraft } from "./post-draft";

/**
 * Unsaved edits kept when the blog editor closes.
 *
 * Leaving the editor through the sidebar, the launcher or the palette
 * unmounts it without asking. A draft is saved on the way out; a published
 * post cannot be (saving would change the live post), and a draft with no
 * title cannot either. So what was unsaved is kept here, in this browser, and
 * offered back the next time the post is opened.
 */

export interface Recovery {
  draft: PostDraft;
  /** ISO time the editor closed. */
  at: string;
}

export const recoveryKey = (post: Pick<BlogPost, "id"> | null) =>
  `blog-editor-recovery:${post?.id ?? "new"}`;

export function keepRecovery(
  key: string,
  draft: PostDraft,
  now = new Date(),
): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ draft, at: now.toISOString() } satisfies Recovery),
    );
  } catch {
    // Storage full or blocked: nothing more can be done from here.
  }
}

export function clearRecovery(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

/** A kept copy that still differs from the post as saved, or null (a stale copy is removed). */
export function readRecovery(post: BlogPost | null): Recovery | null {
  const key = recoveryKey(post);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Recovery>;
    if (!parsed?.draft || typeof parsed.at !== "string") {
      clearRecovery(key);
      return null;
    }
    const draft = { ...draftFromPost(post), ...parsed.draft };
    if (sameDraft(draft, draftFromPost(post))) {
      clearRecovery(key);
      return null;
    }
    return { draft, at: parsed.at };
  } catch {
    return null;
  }
}
