"use client";

import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import type {
  LibraryHighlight,
  LibraryKind,
  LibrarySource,
  LibraryStatus,
} from "@/types";
import { libraryApi } from "@/store/api/admin/libraryApi";
import LibraryPage from "./library-page";

/** Placeholder rows: the harness checks layout, not a reading list. */
const KINDS: LibraryKind[] = ["book", "article", "video", "podcast", "other"];
const STATUSES: LibraryStatus[] = ["in_progress", "want", "done", "abandoned"];
const SOURCES: LibrarySource[] = Array.from({ length: 10 }, (_, i) => ({
  id: `s${i}`,
  kind: KINDS[i % KINDS.length],
  title: `Sample source ${i + 1}`,
  creator: `Creator ${i + 1}`,
  status: STATUSES[i % STATUSES.length],
  url: null,
  started_on: "2026-09-12",
  updated_at: `2026-10-0${(i % 5) + 1}T10:00:00Z`,
}));
const HIGHLIGHTS: LibraryHighlight[] = Array.from({ length: 6 }, (_, i) => ({
  id: `h${i}`,
  source_id: i < 4 ? `s${i}` : null,
  text: `Sample highlight ${i + 1}. ${"A longer line to wrap. ".repeat(i % 3)}`,
  note: i % 2 ? "A note about it." : null,
  is_favorite: i % 3 === 0,
  is_public: i % 2 === 0,
})) as LibraryHighlight[];

/**
 * The real Library screen in the workspace frame, its two queries answered
 * in memory, so the layout can be checked in a browser. For looking only:
 * saving or deleting would reach the real project.
 */
export function LibraryHarness() {
  const dispatch = useDispatch() as (action: unknown) => void;
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    dispatch(
      libraryApi.util.upsertQueryData("getLibrarySources", undefined, SOURCES),
    );
    dispatch(
      libraryApi.util.upsertQueryData(
        "getLibraryHighlights",
        undefined,
        HIGHLIGHTS,
      ),
    );
    setSeeded(true);
  }, [dispatch]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-secondary/30">
      <header className="sticky top-0 z-chrome flex h-14 shrink-0 items-center border-b bg-card px-4 sm:px-6">
        Workspace
      </header>
      <main className="flex-1 px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-wide">
          {seeded && <LibraryPage />}
        </div>
      </main>
    </div>
  );
}
