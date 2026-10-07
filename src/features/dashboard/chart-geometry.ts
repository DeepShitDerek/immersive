/**
 * The maths behind the dashboard's charts.
 *
 * Hand-rolled SVG rather than a charting library, for two reasons. Recharts
 * costs this route about 180 kB and it was just removed; and a sparkline is
 * forty lines of geometry, most of which is deciding what to do when the data
 * is degenerate — one point, all-equal values, an empty series. A library hides
 * those decisions rather than removing them.
 *
 * Pure and separate from the components because every bug in a chart is a bug
 * in its arithmetic, and arithmetic is testable in a way that an SVG path
 * inside a React tree is not.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Map a series into a viewBox.
 *
 * The vertical scale is the interesting part. A series that never varies —
 * seven days of exactly zero — has no range to divide by, and the honest
 * answer is a flat line through the middle rather than a division by zero or a
 * line pinned to the floor.
 *
 * The baseline is always included, so a chart of spending reads against zero
 * instead of against its own smallest value; otherwise a week where you spent
 * £90–£100 every day looks like a cliff.
 */
export function scalePoints(
  values: number[],
  width: number,
  height: number,
): Point[] {
  if (values.length === 0) return [];

  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min;

  if (values.length === 1) {
    return [{ x: width / 2, y: range === 0 ? height / 2 : 0 }];
  }

  const step = width / (values.length - 1);

  return values.map((value, index) => ({
    x: index * step,
    // Flat series sit in the middle: a line along the bottom would read as
    // "nothing happened" when the truth is "nothing changed".
    y: range === 0 ? height / 2 : height - ((value - min) / range) * height,
  }));
}

/** A polyline through the points. Empty string for an empty series. */
export function linePath(points: Point[]): string {
  if (points.length === 0) return "";
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`,
    )
    .join(" ");
}

/**
 * The same line, closed to the floor so it can be filled.
 *
 * A single point still produces a fillable shape rather than a zero-width
 * sliver, which would render as nothing at all.
 */
export function areaPath(points: Point[], height: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [only] = points;
    return `M0 ${round(height)} L0 ${round(only.y)} L${round(only.x * 2)} ${round(only.y)} L${round(only.x * 2)} ${round(height)} Z`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${round(last.x)} ${round(height)} L${round(first.x)} ${round(height)} Z`;
}

/** Two decimals is well past what a pixel can show, and keeps the path short. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A grid of the last `weeks` weeks, oldest first, aligned so each row is one
 * weekday.
 *
 * Returned as a flat list with its dates, so the caller decides the layout and
 * this stays testable. Dates are built from local calendar fields — an ISO
 * slice would shift the whole grid by a day for anyone west of Greenwich.
 */
export function heatmapDates(weeks: number, today = new Date()): string[] {
  const days = weeks * 7;
  const out: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - offset,
    );
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    out.push(`${date.getFullYear()}-${month}-${day}`);
  }

  return out;
}

/**
 * Bucket an intensity into the four steps the palette has.
 *
 * Four rather than a continuous ramp: opacity differences below about 20% are
 * invisible against a card, so a continuous scale spends most of its range
 * saying nothing.
 */
export function heatLevel(intensity: number): 0 | 1 | 2 | 3 {
  if (intensity <= 0) return 0;
  if (intensity < 0.5) return 1;
  if (intensity < 1) return 2;
  return 3;
}
