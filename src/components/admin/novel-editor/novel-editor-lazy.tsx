"use client";

import dynamic from "next/dynamic";
import { loadNovelEditor } from "./load-editor";

// The TipTap suite (starter kit + 14 extensions + markdown serializer) is the
// heaviest admin dependency after FullCalendar, and every editing surface pulls
// it in. Splitting it here — at the single barrel entry point — keeps it out of
// the notes, learning, content and blog page chunks until an editor is mounted.
// The placeholder fills whatever box the caller already sized, so nothing shifts.
// Loaded through `loadNovelEditor` so the note reader's warm-up fetches the
// same chunk, and so tests can mock it with a static import.
const NovelEditorLazy = dynamic(() => loadNovelEditor(), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted/30" />,
});

export default NovelEditorLazy;
