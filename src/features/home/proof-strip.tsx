import { cn } from "@/lib/cn";

const PROOF_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

/**
 * Results, read as a ruled table directly under the promise, inside the first
 * screen. Only what the owner entered appears: there is no default row
 * of flattering numbers.
 *
 * A description list, so each figure is announced with its label. The value
 * is drawn above the label, but the label comes first in the source.
 * Figures are the real text from the first paint: they do not count up,
 * which showed "0" to anyone who looked before the animation ran.
 */
export function ProofStrip({
  items,
  label = "Results",
}: {
  items: { value: string; label: string }[];
  label?: string;
}) {
  return (
    <dl
      aria-label={label}
      className={cn(
        "mt-12 grid grid-cols-2 border-y border-border",
        PROOF_COLUMNS[items.length] ?? "sm:grid-cols-4",
      )}
    >
      {items.map((item, index) => (
        <div
          key={`${item.value}-${index}`}
          className={cn(
            "flex min-w-0 flex-col-reverse gap-1 py-5 pr-4",
            // Hairlines between columns; on phones, between the two of a row
            // and above the second row.
            index % 2 === 1 && "border-l border-border pl-4",
            index >= 2 && "border-t border-border sm:border-t-0",
            index > 0 && "sm:border-l sm:pl-5",
          )}
        >
          <dt className="text-pretty text-sm leading-snug text-muted-foreground">
            {item.label}
          </dt>
          <dd className="t-heading tabular-nums text-foreground [overflow-wrap:anywhere] sm:text-[length:var(--t-title)] sm:leading-[1.1]">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
