import type { SiteSettingsFormValues } from "@/lib/schemas";

/**
 * The machinery behind per-group save.
 *
 * The settings screen is one form over one row, but it saves one group at a
 * time. That needs three things kept honest, and all three are pure functions
 * so they can be tested without a DOM:
 *
 *   - which fields belong to the group (`FieldPath[]`, from the registry),
 *   - what to write (`buildGroupPayload`) — the group's edits laid over the
 *     last known server state, so saving Footer never persists a half-finished
 *     Theme edit sitting in the same form,
 *   - what counts as an error for this group (`issuesForGroup`) — so an invalid
 *     GitHub username stops the GitHub group and nothing else. That was the
 *     old screen's worst behaviour: one resolver over one submit meant a bad
 *     value anywhere blocked every unrelated save.
 */

/** A dotted path into the settings form values, e.g. `profile_data.logo.main`. */
export type FieldPath = string;

type Unknown = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Read a dotted path. Returns undefined for any missing segment. */
export function getAtPath(source: unknown, path: FieldPath): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node === null || node === undefined) return undefined;
    return (node as Unknown)[key];
  }, source);
}

/**
 * Write a dotted path, cloning each object on the way down.
 *
 * Cloning matters: the base is the RTK Query cache entry, which is frozen in
 * development and shared with every other subscriber in production. Mutating
 * it in place would edit the public site's cached identity as a side effect of
 * building a payload.
 */
function setAtPath<T>(target: T, path: FieldPath, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const base: Unknown = isPlainObject(target) ? { ...target } : {};

  if (rest.length === 0) {
    base[head] = value;
  } else {
    base[head] = setAtPath(base[head] ?? {}, rest.join("."), value);
  }

  return base as T;
}

/** Structural equality, order-insensitive for object keys. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return Array.from(keys).every((key) => deepEqual(a[key], b[key]));
  }
  return false;
}

/**
 * The write for one group: the whole server row, with only this group's fields
 * replaced by what the form currently holds.
 *
 * Only the top-level columns the group actually touches appear in the result,
 * so saving the footer sends `footer_data` and nothing else — `profile_data` is
 * not rewritten, and cannot be clobbered by a concurrent edit from another tab.
 */
export function buildGroupPayload(
  serverState: SiteSettingsFormValues,
  formValues: SiteSettingsFormValues,
  paths: readonly FieldPath[],
): Partial<SiteSettingsFormValues> {
  const columns = new Set(paths.map((path) => path.split(".")[0]));

  let payload: Partial<SiteSettingsFormValues> = {};
  for (const column of Array.from(columns)) {
    payload = setAtPath(
      payload,
      column,
      (serverState as unknown as Unknown)[column],
    );
  }

  for (const path of paths) {
    payload = setAtPath(payload, path, getAtPath(formValues, path));
  }

  return payload;
}

/** Has anything in this group moved since the row was loaded? */
export function groupIsDirty(
  serverState: SiteSettingsFormValues,
  formValues: SiteSettingsFormValues,
  paths: readonly FieldPath[],
): boolean {
  return paths.some(
    (path) =>
      !deepEqual(getAtPath(serverState, path), getAtPath(formValues, path)),
  );
}

/**
 * Whether a validation issue belongs to this group.
 *
 * Matches on path segments rather than on the joined string, so the group
 * `profile_data.title` does not swallow issues raised against
 * `profile_data.title_something_else`.
 */
function pathBelongsTo(
  issuePath: readonly (string | number)[],
  groupPath: FieldPath,
): boolean {
  const wanted = groupPath.split(".");
  return wanted.every((segment, index) => String(issuePath[index]) === segment);
}

export interface SettingsIssue {
  path: readonly (string | number)[];
  message: string;
}

/** The subset of a full-form parse that this group is answerable for. */
export function issuesForGroup(
  issues: readonly SettingsIssue[],
  paths: readonly FieldPath[],
): SettingsIssue[] {
  return issues.filter((issue) =>
    paths.some((path) => pathBelongsTo(issue.path, path)),
  );
}
