import { useEffect, useRef, useState } from "react";

/**
 * "New task", "New note"… from Quick add and the palette.
 *
 * Those commands used to navigate only, leaving you on the module with no
 * form open ("New blog post" sent a `?create=true` nothing read). Now the
 * command leaves a request here, navigates, and the module opens its own
 * create form when it mounts, or at once if it is already on screen. A
 * request is held in memory rather than the URL, so a reload or the Back
 * button never opens a form again, and it lapses after a few seconds so a
 * module that could not honour it (Money with no accounts) does not surprise
 * you on a later visit.
 */
export type CreateTarget = "task" | "note" | "transaction" | "post";

const CREATE_PATHS: Record<CreateTarget, string> = {
  task: "/admin/tasks",
  note: "/admin/notes",
  transaction: "/admin/finance",
  post: "/admin/blog",
};

const EVENT = "admin:create-intent";
const LAPSE_MS = 10_000;

let pending: { target: CreateTarget; at: number } | null = null;

export function requestCreate(
  target: CreateTarget,
  navigate: (path: string) => void,
  now = Date.now(),
): void {
  pending = { target, at: now };
  navigate(CREATE_PATHS[target]);
  document.dispatchEvent(new Event(EVENT));
}

/** True once for a live request for `target`; it is then used up. */
export function takeCreateIntent(
  target: CreateTarget,
  now = Date.now(),
): boolean {
  if (!pending) return false;
  if (now - pending.at > LAPSE_MS) {
    pending = null;
    return false;
  }
  if (pending.target !== target) return false;
  pending = null;
  return true;
}

/**
 * Calls `onCreate` when a request for `target` arrives. `ready` holds the
 * request until the module can act on it (its data has loaded).
 */
export function useCreateIntent(
  target: CreateTarget,
  onCreate: () => void,
  ready = true,
): void {
  const callback = useRef(onCreate);
  useEffect(() => {
    callback.current = onCreate;
  });
  const [arrivals, setArrivals] = useState(0);
  useEffect(() => {
    const arrived = () => setArrivals((n) => n + 1);
    document.addEventListener(EVENT, arrived);
    return () => document.removeEventListener(EVENT, arrived);
  }, []);
  useEffect(() => {
    if (ready && takeCreateIntent(target)) callback.current();
  }, [target, ready, arrivals]);
}
