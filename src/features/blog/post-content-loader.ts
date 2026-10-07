/**
 * The one place the post body's chunk is imported.
 *
 * The markdown pipeline (raw → sanitize → prism/refractor → slug) is the
 * heaviest thing on /blog/view, so the page loads it lazily and warms it
 * alongside the post query. Both of those used to call `import("./post-content")`
 * inline. That made the import impossible to intercept reliably in tests: on
 * CI the real pipeline loaded after the test environment had been torn down
 * and failed the run with an unhandled rejection, though every test passed.
 *
 * A static import of this module is something every test runner can mock, so
 * the page keeps its code split and the test never touches the real chunk.
 */
export function loadPostContent() {
  return import("./post-content");
}
