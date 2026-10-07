/**
 * Line art for a project with no image, made from its title and tags, so the
 * same project always gets the same pattern and no image file is ever added.
 * Pure: no randomness, no clock.
 */
export interface Pattern {
  kind: "rings" | "grid" | "waves" | "rays";
  /** SVG path data in a 0 0 400 300 box. */
  paths: string[];
}

const W = 400;
const H = 300;
const KINDS = ["rings", "grid", "waves", "rays"] as const;

/** FNV-1a over UTF-16 code units. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator, enough for line art. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function circle(cx: number, cy: number, r: number): string {
  return `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(r * 2)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-r * 2)} 0`;
}

export function projectPattern(
  title: string,
  tags: readonly string[] = [],
): Pattern {
  const key = [
    title.trim().toLowerCase(),
    ...tags.map((t) => t.trim().toLowerCase()).sort(),
  ].join("|");
  const seed = hash(key);
  const next = seeded(seed);
  const kind = KINDS[seed % KINDS.length];
  const count = 8 + Math.floor(next() * 10);
  const paths: string[] = [];

  if (kind === "rings") {
    const cx = W * (0.3 + next() * 0.4);
    const cy = H * (0.3 + next() * 0.4);
    const step = 10 + next() * 12;
    for (let i = 1; i <= count; i += 1) paths.push(circle(cx, cy, i * step));
  } else if (kind === "grid") {
    const skew = (next() - 0.5) * 80;
    const cols = Math.ceil(count / 2);
    for (let i = 0; i <= cols; i += 1) {
      const x = (W / cols) * i;
      paths.push(`M${r1(x)} 0L${r1(x + skew)} ${H}`);
    }
    for (let i = 0; i <= count - cols; i += 1) {
      const y = (H / Math.max(1, count - cols)) * i;
      paths.push(`M0 ${r1(y)}L${W} ${r1(y + skew / 2)}`);
    }
  } else if (kind === "waves") {
    const amp = 10 + next() * 26;
    const len = 60 + next() * 90;
    for (let i = 0; i < count; i += 1) {
      const y = (H / (count + 1)) * (i + 1);
      let d = `M0 ${r1(y)}`;
      for (let x = len; x <= W + len; x += len) {
        const up = (Math.round(x / len) + i) % 2 === 0 ? -amp : amp;
        d += `Q${r1(x - len / 2)} ${r1(y + up)} ${r1(x)} ${r1(y)}`;
      }
      paths.push(d);
    }
  } else {
    const ox = next() < 0.5 ? 0 : W;
    const oy = H * next();
    for (let i = 0; i < count; i += 1) {
      const y = (H / (count - 1)) * i;
      paths.push(`M${ox} ${r1(oy)}L${W - ox} ${r1(y)}`);
    }
  }

  return { kind, paths };
}
