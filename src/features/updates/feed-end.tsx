/**
 * The end of the feed, said plainly.
 *
 * It used to be a handwritten "that's all for now" between two rules. The rules
 * were separators drawn as lines, and the script face was the scrapbook's. What
 * a reader wants at the bottom is to know the list is complete and how far back
 * it goes, so that is what it says.
 */
export function FeedEnd({
  label = "You're all caught up",
  detail,
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div className="mt-16 flex flex-col items-center gap-1 text-center">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
    </div>
  );
}
