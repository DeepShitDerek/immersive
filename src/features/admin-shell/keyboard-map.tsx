"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isMac,
  isTypingTarget,
  shortcutLabel,
} from "@/features/maps/state/keyboard";
import { shortcutsOwnedByEditor } from "@/lib/editor-shortcuts";
import { REVIEW_RATINGS } from "@/features/learning/spaced-review";

/** Opens the keyboard map from elsewhere (the command palette). */
export const OPEN_KEYBOARD_MAP = "open-keyboard-map";

type Row = [action: string, keys: string];

/**
 * Every keyboard shortcut in the workspace, on "?".
 *
 * Only keys that work. The palette used to show chord hints ("C P") with
 * nothing behind them. Maps' keys and the review ratings are read
 * from where they are defined, so this list cannot drift from them.
 */
export function keyboardSections(
  mac: boolean,
): { title: string; rows: Row[] }[] {
  const mod = mac ? "⌘" : "Ctrl+";
  return [
    {
      title: "Everywhere",
      rows: [
        ["Search, or jump to a module", `${mod}K`],
        ["This list", "?"],
        ["Close a dialog or sheet", "Esc"],
      ],
    },
    {
      title: "Blog editor",
      rows: [["Leave focus mode", "Esc"]],
    },
    {
      title: "Learning review",
      rows: [
        ["Show the answer", "Space"],
        ...REVIEW_RATINGS.map(
          (r, i): Row => [`Rate “${r.label}”`, String(i + 1)],
        ),
      ],
    },
    {
      title: "Calendar",
      rows: [
        ["Today", "T"],
        ["Previous / next", "← / →"],
        ["Day, 3 days, week, month, agenda", "D 3 W M A"],
        ["New event", "N"],
        ["Move an event", "Drag it"],
        ["Change its length", "Drag its bottom edge"],
      ],
    },
    {
      title: "Maps",
      rows: [
        ["Add a child", shortcutLabel("addChild", mac)],
        ["Add a sibling", shortcutLabel("addSibling", mac)],
        ["Rename", shortcutLabel("rename", mac)],
        ["Connect selected", shortcutLabel("connect", mac)],
        ["Duplicate", shortcutLabel("duplicate", mac)],
        ["Search / quick add", shortcutLabel("search", mac)],
        ["Fit to screen", shortcutLabel("fit", mac)],
        [
          "Undo / redo",
          `${shortcutLabel("undo", mac)} / ${shortcutLabel("redo", mac)}`,
        ],
      ],
    },
  ];
}

export function KeyboardMap() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (isTypingTarget(event.target)) return;
      // The whiteboard has its own "?" help.
      if (shortcutsOwnedByEditor()) return;
      event.preventDefault();
      setOpen(true);
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    document.addEventListener(OPEN_KEYBOARD_MAP, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener(OPEN_KEYBOARD_MAP, onOpen);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Keys that work while you are not typing in a field.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {keyboardSections(open ? isMac() : false).map((section) => (
            <section
              key={section.title}
              aria-labelledby={`keys-${section.title}`}
            >
              <h3
                id={`keys-${section.title}`}
                className="mb-2 text-xs font-medium text-muted-foreground"
              >
                {section.title}
              </h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                {section.rows.map(([action, keys]) => (
                  <div key={action} className="contents">
                    <dt>{action}</dt>
                    <dd>
                      <kbd className="rounded-control border bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {keys}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
