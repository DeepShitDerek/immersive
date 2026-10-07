"use client";

import { X } from "lucide-react";
import { addTags } from "@/lib/tag-input";
import { cn } from "@/lib/cn";

/**
 * Tags as chips: type one and press Enter or a comma; Backspace in an empty
 * field removes the last; leaving the field keeps what was typed.
 *
 * Controlled in both halves — the chips and the half-typed draft — so a form
 * can include a tag the user typed but never committed when it saves.
 */
export function TagInput({
  tags,
  onTagsChange,
  draft,
  onDraftChange,
  placeholder = "Add tags",
  label = "Add a tag",
  className,
  chipClassName,
}: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  draft: string;
  onDraftChange: (draft: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  chipClassName?: string;
}) {
  const commit = () => {
    if (!draft.trim()) return;
    onTagsChange(addTags(tags, draft));
    onDraftChange("");
  };

  return (
    <div
      role="group"
      aria-label="Tags"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2.5 pr-1 text-xs font-medium text-secondary-foreground",
            chipClassName,
          )}
        >
          #{tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
            className="rounded-full p-0.5 hover:bg-background/60 focus-ring"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        aria-label={label}
        value={draft}
        onChange={(event) => {
          const value = event.target.value;
          if (value.includes(",")) {
            onTagsChange(addTags(tags, value));
            onDraftChange("");
          } else {
            onDraftChange(value);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !(event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            commit();
          } else if (event.key === "Backspace" && !draft && tags.length) {
            onTagsChange(tags.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={tags.length ? "Add tag" : placeholder}
        className="min-w-[6rem] flex-1 bg-transparent py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
