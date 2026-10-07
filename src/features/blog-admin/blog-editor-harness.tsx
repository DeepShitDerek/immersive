"use client";

import BlogEditor from "./blog-editor";

/**
 * The editor inside the same frame AdminShell gives it in the launcher
 * layout: the page ground, a sticky 56px top bar, and the content column
 * capped at the wide measure. The editor's own bar is pinned under the top
 * bar and has to reach the window's edges however wide the window is.
 */
export function BlogEditorHarness() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-secondary/30">
      <header className="sticky top-0 z-chrome flex h-14 shrink-0 items-center border-b bg-card px-4 sm:px-6">
        Workspace
      </header>
      <main className="flex-1 px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-wide">
          <BlogEditor
            post={null}
            onClose={() => {}}
            onCreated={() => {}}
            onDelete={() => {}}
          />
        </div>
      </main>
    </div>
  );
}
