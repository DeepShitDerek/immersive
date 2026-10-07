"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Sidebar rail or app launcher, as the owner's choice.
 *
 * This project has argued itself round this loop twice — rail, then floating
 * pill bar with navigation behind a keystroke, then rail again, then launcher
 * — and each answer was defended as the correct one. That is usually a sign
 * there is no correct one: a rail is worth its 15rem on a wide monitor where
 * the space is free, and is a sixth of the screen on a laptop. Making it a
 * preference is the honest end of that argument.
 *
 * **Stored per device, in `localStorage`.** Deliberately not in the database:
 * the right answer genuinely differs between a 27-inch monitor and a 13-inch
 * laptop, and a synced setting would make choosing on one of them the wrong
 * choice on the other. It is also not site content — `site_identity` is
 * publicly readable, and how the owner arranges their own admin chrome is
 * nobody else's business.
 *
 * `CLAUDE.md` currently states the shell has no rail. That was written when the
 * rail had been removed, and the rail came back anyway without the file being
 * updated — which is how the contradiction this pass found got there. With the
 * rail now a supported option, that line needs revising rather than quietly
 * contradicting the code again.
 */

export type ShellLayout = "launcher" | "sidebar";

const SHELL_LAYOUT_KEY = "admin_shell_layout";

export const SHELL_LAYOUTS: { id: ShellLayout; label: string; hint: string }[] =
  [
    {
      id: "launcher",
      label: "App launcher",
      hint: "Every module in a grid. Gives the width back to the page.",
    },
    {
      id: "sidebar",
      label: "Sidebar rail",
      hint: "Always-visible list. Worth the space on a wide screen.",
    },
  ];

function read(): ShellLayout {
  try {
    return localStorage.getItem(SHELL_LAYOUT_KEY) === "sidebar"
      ? "sidebar"
      : "launcher";
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null. The launcher is the safe default: it works at every
    // width, whereas the rail assumes there is room for it.
    return "launcher";
  }
}

export function useShellLayout() {
  const [layout, setLayout] = useState<ShellLayout>("launcher");
  /**
   * Whether the stored preference has been read yet.
   *
   * The value cannot be read during render — `localStorage` does not exist on
   * the server, and this app is a static export whose HTML is written at build
   * time. Rendering the rail before the preference is known would flash it in
   * and out for anyone who chose the launcher.
   */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLayout(read());
    setReady(true);
  }, []);

  const choose = useCallback((next: ShellLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(SHELL_LAYOUT_KEY, next);
    } catch {
      // Not being able to remember the choice is no reason to refuse to apply
      // it for this session.
    }
  }, []);

  return { layout, choose, ready };
}
