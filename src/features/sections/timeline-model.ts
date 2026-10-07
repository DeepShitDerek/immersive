/**
 * The model behind the branching timeline.
 *
 * ## What the data can and cannot say
 *
 * `portfolio_items` has `date_from` and `date_to` as free-text **TEXT**
 * columns, and no parent, branch or lane field of any kind. That bounds what
 * an honest git-style graph can claim:
 *
 * - **Chronology** — yes, for values this parser can read.
 * - **Parallel tracks** — yes. Two items whose ranges overlap *were* concurrent,
 *   and that is real branching in the only sense the data supports.
 * - **An open branch** — yes. A missing `date_to` means ongoing, matching what
 *   `ItemDates` already renders as "— Present". The two must agree, or the
 *   graph would draw a line ending where the label says it continues.
 * - **A merge** — **no.** A true merge is "X was merged into Y", which needs an
 *   explicit parent pointer. Inferring one from "this ended around when that
 *   began" would invent a relationship the owner never stated. So a lane is
 *   drawn *rejoining the trunk* when it ends — which is true, the concurrency
 *   stopped — and nothing claims causation.
 *
 * Adding `depends_on` to `portfolio_items` is the right change if real merges
 * are wanted later. It is deliberately not made on speculation.
 *
 * ## Why the dates are only ever compared, never displayed
 *
 * The column is free text, so a value can be `2023`, `Jan 2023`, `2023-01-15`
 * or `Summer 2022`. Anything this parser cannot read yields **null** rather
 * than a guess — a timeline that silently orders "Summer 2022" as the epoch is
 * worse than one that admits it does not know. Undated items keep their given
 * order and sit on the trunk, claiming nothing.
 *
 * Parsed values are built with `Date.UTC` and used **only** for comparison.
 * Rendering keeps the author's own strings, so the local-versus-UTC trap this
 * project has hit four times cannot apply here: no parsed value is ever
 * formatted back out.
 */

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** Words an author writes to mean "still going". */
const ONGOING_WORDS = new Set([
  "present",
  "now",
  "current",
  "ongoing",
  "today",
]);

export function isOngoingWord(value?: string | null): boolean {
  return ONGOING_WORDS.has((value ?? "").trim().toLowerCase());
}

/**
 * A free-text date as a comparable number, or null when it cannot be read.
 *
 * Handles the forms an author actually types: a bare year, `YYYY-MM`,
 * `YYYY-MM-DD`, `MM/YYYY`, and `Mon YYYY` / `Month YYYY` in either order.
 * Everything else — "Summer 2022", "the pandemic" — is null on purpose.
 */
function parseTimelinePoint(value?: string | null): number | null {
  const raw = (value ?? "").trim();
  if (!raw || isOngoingWord(raw)) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (iso) {
    return Date.UTC(+iso[1], Math.min(+iso[2], 12) - 1, iso[3] ? +iso[3] : 1);
  }

  const slash = raw.match(/^(\d{1,2})[/](\d{4})$/);
  if (slash) return Date.UTC(+slash[2], Math.min(+slash[1], 12) - 1, 1);

  const named = raw.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/);
  if (named) {
    const month = MONTHS.indexOf(named[1].slice(0, 3).toLowerCase());
    if (month !== -1) return Date.UTC(+named[2], month, 1);
  }

  const namedAfter = raw.match(/^(\d{4})\s+([A-Za-z]{3,})\.?$/);
  if (namedAfter) {
    const month = MONTHS.indexOf(namedAfter[2].slice(0, 3).toLowerCase());
    if (month !== -1) return Date.UTC(+namedAfter[1], month, 1);
  }

  const year = raw.match(/^(\d{4})$/);
  if (year) return Date.UTC(+year[1], 0, 1);

  return null;
}

interface TimelineSpan {
  start: number;
  /** `now` for an ongoing item, so an open branch overlaps everything current. */
  end: number;
  ongoing: boolean;
}

export interface TimelineRow<T> {
  item: T;
  /** 0 is the trunk. */
  lane: number;
  /** Null when neither date could be read; such rows stay on the trunk. */
  span: TimelineSpan | null;
}

interface MergeEdge {
  /** Row index of the branch that ends. */
  fromRow: number;
  fromLane: number;
  /** Row index of the item it fed into. */
  toRow: number;
  toLane: number;
}

interface LaneSpan {
  lane: number;
  /** Topmost (newest) row index the lane reaches. */
  firstRow: number;
  /** Bottommost (oldest) row index the lane reaches. */
  lastRow: number;
}

export interface TimelineGraph<T> {
  rows: TimelineRow<T>[];
  laneCount: number;
  laneSpans: LaneSpan[];
  /** Declared merges, resolved to the rows that are actually on screen. */
  merges: MergeEdge[];
}

export interface DatedFields {
  id?: string;
  date_from?: string | null;
  date_to?: string | null;
  merged_into_id?: string | null;
}

/**
 * Declared merges, as edges between rows that are both on screen.
 *
 * A target outside this section is dropped rather than drawn to nowhere — an
 * item can be filed under a different section from the one it fed into, and a
 * line running off the edge of the graph says less than no line.
 *
 * Direction is deliberately *not* restricted. Rows are ordered by start date,
 * so a branch that began later than the work it fed into sits **above** it —
 * a side project started in 2021 that merged into a job running since 2020 is
 * the ordinary case, not an error. An earlier draft required the target to be
 * above the branch and dropped exactly that arrangement; the test caught it.
 *
 * Cycles are the database's job, not this function's: the
 * client can only prevent the loops it thinks of.
 */
function resolveMerges<T extends DatedFields>(
  rows: TimelineRow<T>[],
): MergeEdge[] {
  const indexById = new Map<string, number>();
  rows.forEach((row, index) => {
    if (row.item.id) indexById.set(row.item.id, index);
  });

  const edges: MergeEdge[] = [];

  rows.forEach((row, fromRow) => {
    const target = row.item.merged_into_id;
    if (!target) return;

    const toRow = indexById.get(target);
    // Self-merge is meaningless and would draw a line from a node to itself.
    if (toRow === undefined || toRow === fromRow) return;

    edges.push({
      fromRow,
      fromLane: row.lane,
      toRow,
      toLane: rows[toRow].lane,
    });
  });

  return edges;
}

function spanOf(item: DatedFields, now: number): TimelineSpan | null {
  const start = parseTimelinePoint(item.date_from);
  const rawEnd = parseTimelinePoint(item.date_to);

  if (start === null && rawEnd === null) return null;

  // A missing or unreadable end means ongoing — the same reading `ItemDates`
  // gives when it prints "— Present". If these two disagreed, the graph would
  // stop a line where the label says the work continues.
  const ongoing = rawEnd === null;
  const from = start ?? rawEnd!;
  const end = ongoing ? Math.max(now, from) : Math.max(rawEnd!, from);

  return { start: from, end, ongoing };
}

/** Half-open overlap: touching at a boundary is not an overlap. */
function overlaps(a: TimelineSpan, b: TimelineSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Order rows and give each a lane.
 *
 * Rows read newest first, which is how a commit log reads. Dated items sort by
 * start descending; undated items cannot be placed on any defensible date, so
 * they keep their given order and follow — appended rather than interleaved,
 * because there is no position for them that would be true.
 *
 * Lanes are greedy first-fit, the same shape the calendar uses for overlapping
 * events: reuse the leftmost lane whose occupant does not overlap. That is
 * what makes consecutive items stack in the trunk instead of marching
 * rightwards, so a lane opening is a real signal that two things ran at once.
 *
 * The calendar's own implementation is deliberately *not* reused: it clips to
 * a day first and normalises a width across each overlap cluster so every
 * event in a cluster is the same size, neither of which a timeline wants.
 * Sharing the two would mean one of them carrying a flag for the other.
 */
export function buildTimeline<T extends DatedFields>(
  items: T[],
  now: number = Date.now(),
): TimelineGraph<T> {
  const dated: { item: T; span: TimelineSpan }[] = [];
  const undated: T[] = [];

  for (const item of items) {
    const span = spanOf(item, now);
    if (span) dated.push({ item, span });
    else undated.push(item);
  }

  dated.sort((a, b) => b.span.start - a.span.start || b.span.end - a.span.end);

  /**
   * Lanes are assigned longest-running first, not in display order.
   *
   * First-fit over the *displayed* order gave lane 0 — the trunk — to whichever
   * item started most recently, so a three-month side project could occupy the
   * spine and push a six-year job out to a branch. The graph then read as
   * though the side project were the main thread of the career.
   *
   * Assigning by duration makes the trunk the thing that actually ran longest,
   * which is what a reader assumes a spine means, and it is what makes a
   * declared merge read correctly: a branch feeding into the trunk rather than
   * the other way round.
   *
   * Ties break on the later start, so two equal-length items still order
   * predictably rather than by whatever the database returned.
   */
  const byDuration = [...dated].sort(
    (a, b) =>
      b.span.end - b.span.start - (a.span.end - a.span.start) ||
      b.span.start - a.span.start,
  );

  const laneOccupants: { lane: number; spans: TimelineSpan[] }[] = [];
  const laneByItem = new Map<(typeof dated)[number], number>();

  for (const entry of byDuration) {
    // The leftmost lane where this overlaps nothing already in it. Checking
    // every occupant rather than only the last matters here: processing by
    // duration means a lane can be handed a span that sits *before* what it
    // already holds.
    let lane = laneOccupants.findIndex(
      (candidate) =>
        !candidate.spans.some((occupant) => overlaps(occupant, entry.span)),
    );

    if (lane === -1) {
      lane = laneOccupants.length;
      laneOccupants.push({ lane, spans: [entry.span] });
    } else {
      laneOccupants[lane].spans.push(entry.span);
    }

    laneByItem.set(entry, lane);
  }

  const rows: TimelineRow<T>[] = dated.map((entry) => ({
    item: entry.item,
    lane: laneByItem.get(entry) ?? 0,
    span: entry.span,
  }));

  for (const item of undated) {
    rows.push({ item, lane: 0, span: null });
  }

  const spansByLane = new Map<number, LaneSpan>();
  rows.forEach((row, index) => {
    const existing = spansByLane.get(row.lane);
    if (existing) existing.lastRow = index;
    else
      spansByLane.set(row.lane, {
        lane: row.lane,
        firstRow: index,
        lastRow: index,
      });
  });

  return {
    rows,
    laneCount: Math.max(laneOccupants.length, rows.length > 0 ? 1 : 0),
    laneSpans: Array.from(spansByLane.values()).sort((a, b) => a.lane - b.lane),
    merges: resolveMerges(rows),
  };
}

const BARE_YEAR = /^\d{4}$/;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/**
 * How long an item lasted, the way a CV says it: "1 yr 3 mos", "5 mos",
 * "3 yrs". Null whenever it cannot be said honestly.
 *
 * - **Months count inclusively**, as a CV does: Jan–Mar is three months.
 * - **A bare year gives years only.** "2020 — 2022" is two years; saying
 *   "2 yrs 0 mos" would claim a precision the author never gave.
 * - **Ongoing work needs `now`**, and is null until it is supplied. The page
 *   is statically exported, so the component reads the clock after mount; a
 *   duration computed at build time would be stale, and would not hydrate.
 */
export function timelineDuration(
  from: string | null | undefined,
  to: string | null | undefined,
  now: number | null,
): string | null {
  const start = parseTimelinePoint(from);
  if (start === null || !from) return null;

  const rawEnd = to?.trim() || null;
  const ongoing = !rawEnd || isOngoingWord(rawEnd);
  if (ongoing && now === null) return null;

  const end = ongoing ? now : parseTimelinePoint(rawEnd);
  if (end === null || end < start) return null;

  const a = new Date(start);
  const b = new Date(end);

  if (BARE_YEAR.test(from.trim()) || (!ongoing && BARE_YEAR.test(rawEnd!))) {
    const years = b.getUTCFullYear() - a.getUTCFullYear();
    return years >= 1 ? plural(years, "yr") : null;
  }

  const months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth()) +
    1;
  const years = Math.floor(months / 12);
  const rest = months % 12;

  return (
    [years > 0 && plural(years, "yr"), rest > 0 && plural(rest, "mo")]
      .filter(Boolean)
      .join(" ") || null
  );
}

/**
 * The main-line row a side track ran alongside — the one it overlapped
 * *most*, so "Alongside Day job" names the job rather than a week-long
 * conference that happened to touch it.
 */
export function trunkAlongside<T>(
  rows: TimelineRow<T>[],
  index: number,
): number | null {
  const row = rows[index];
  if (!row || row.lane === 0 || !row.span) return null;
  const span = row.span;

  let best: number | null = null;
  let bestOverlap = 0;
  rows.forEach((candidate, i) => {
    if (candidate.lane !== 0 || !candidate.span) return;
    if (!overlaps(candidate.span, span)) return;
    const overlap =
      Math.min(candidate.span.end, span.end) -
      Math.max(candidate.span.start, span.start);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = i;
    }
  });
  return best;
}
