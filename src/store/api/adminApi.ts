/**
 * Admin API barrel. The actual endpoints live in per-feature slices under
 * `./admin/` and are injected into the base slice on import. Always import
 * from THIS file (not from a feature file directly) — loading the barrel is
 * what registers every endpoint before the store is used.
 *
 * `adminApi` itself (reducer, middleware, `util.invalidateTags`) comes from
 * the base slice and is shared by all features.
 */
export { adminApi } from "./admin/baseApi";

export * from "./admin/authApi";
export * from "./admin/dashboardApi";
export * from "./admin/calendarApi";
export * from "./admin/blogAdminApi";
export * from "./admin/notesApi";
export * from "./admin/whiteboardApi";
export * from "./admin/mapsApi";
export * from "./admin/tasksApi";
export * from "./admin/learningApi";
export * from "./admin/siteApi";
export * from "./admin/portfolioApi";
export * from "./admin/assetsApi";
export * from "./admin/habitsApi";
export * from "./admin/inventoryApi";
export * from "./admin/lifeUpdatesApi";
export * from "./admin/inboxApi";
export * from "./admin/analyticsApi";
export * from "./admin/calendarSetupApi";
export * from "./admin/discoverApi";
export * from "./admin/libraryApi";
// Finance (migrations 025–032). The only finance slice: the four v1 ones —
// financeApi, financeSetupApi, loansApi and importApi — were deleted when the
// rebuilt module took over `/admin/finance`.
