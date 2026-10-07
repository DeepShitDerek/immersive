import LoadingState from "./shared/loading-state";

/**
 * Kept as the `next/dynamic` loading fallback for the code-split admin routes
 * (dashboard, calendar), where a default-exported component reads better at the
 * call site than an inline arrow. It delegates so there is still exactly one
 * spinner implementation — see `shared/loading-state`.
 */
export default function LoadingSpinner() {
  return <LoadingState variant="page" />;
}
