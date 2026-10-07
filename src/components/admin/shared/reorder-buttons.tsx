import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Move up / move down for a row in a reorderable list: Content's section
 * tree and Navigation's links share this, so they look and behave the same.
 *
 * Revealed on hover or keyboard focus, so a list of rows stays quiet; always
 * visible where there is no hover (touch), where dragging is not available
 * either. A direction that cannot move is hidden but keeps its space, so the
 * other chevron does not jump.
 */
export default function ReorderButtons({
  name,
  onMoveUp,
  onMoveDown,
}: {
  /** What moves, for the buttons' accessible names. */
  name: string;
  /** Left out when the row is already first. */
  onMoveUp?: () => void;
  /** Left out when the row is already last. */
  onMoveDown?: () => void;
}) {
  return (
    <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
      {[
        { label: "Move up", onClick: onMoveUp, Icon: ChevronUp },
        { label: "Move down", onClick: onMoveDown, Icon: ChevronDown },
      ].map(({ label, onClick, Icon }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          disabled={!onClick}
          aria-label={`${label}: ${name}`}
          className="inline-flex size-6 items-center justify-center rounded-control text-muted-foreground hover:bg-secondary hover:text-foreground focus-ring disabled:invisible"
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </span>
  );
}
