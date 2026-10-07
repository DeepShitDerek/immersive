/**
 * The one place the TipTap editor's chunk is imported.
 *
 * The lazy wrapper mounts it and the note reader warms it ahead of the first
 * Edit click; both used to call `import(...)` inline. A dynamic import written
 * inline is not reliably intercepted by a test's module mock, and a warm-up
 * nobody awaits can outlive the test: the blog page's equivalent loaded its
 * real markdown pipeline after the environment was torn down and failed a CI
 * run with an unhandled rejection. A static import of this module mocks
 * reliably, so tests never load the editor for real.
 */
export function loadNovelEditor() {
  return import("./novel-editor");
}
