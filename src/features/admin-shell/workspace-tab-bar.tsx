"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  LayoutDashboard,
  ListTodo,
  MoreHorizontal,
  Search,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { ModuleGrid } from "./app-launcher";
import { isActiveNavHref, NAV_GROUPS } from "./nav-config";

/** The four modules opened most days, each one tap from anywhere. */
const TABS: { name: string; href: string; icon: LucideIcon }[] = [
  { name: "Today", href: "/admin", icon: LayoutDashboard },
  { name: "Tasks", href: "/admin/tasks", icon: ListTodo },
  { name: "Notes", href: "/admin/notes", icon: StickyNote },
  { name: "Money", href: "/admin/finance", icon: Banknote },
];

/** Whether the current module is one of the tabs; otherwise "More" is current. */
export function currentTab(pathname: string): string | null {
  return TABS.find((tab) => isActiveNavHref(pathname, tab.href))?.href ?? null;
}

const TAB =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control py-1.5 text-micro font-medium transition-colors duration-fast focus-ring";

/**
 * The workspace on a phone: a bottom tab bar (information-architecture
 * §6).
 *
 * Below `lg` the only way between modules was the launcher at the top right,
 * the hardest place on a phone to reach with a thumb. Four daily modules are
 * now tabs, and **More** opens every module as a sheet from the bottom, the
 * same grouped grid the launcher shows, with search into the command palette
 * at its head.
 *
 * Labels sit under the icons, because an icon alone is a guess. The bar
 * reserves the device's safe area, and the page reserves the bar's height
 * (`--tabbar-h` in globals.css), so nothing ends up behind it.
 */
export function WorkspaceTabBar() {
  const pathname = usePathname() ?? "/admin";
  const [moreOpen, setMoreOpen] = useState(false);
  const active = currentTab(pathname);

  return (
    <>
      <nav
        aria-label="Workspace"
        data-workspace-tabbar
        className="fixed inset-x-0 bottom-0 z-chrome border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      >
        <ul className="mx-auto flex h-14 max-w-lg items-stretch gap-1 px-2">
          {TABS.map((tab) => {
            const current = active === tab.href;
            return (
              <li key={tab.href} className="flex flex-1">
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    TAB,
                    current
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon className="size-5 shrink-0" aria-hidden />
                  <span className="truncate">{tab.name}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                TAB,
                active === null
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MoreHorizontal className="size-5 shrink-0" aria-hidden />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-surface px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
        >
          <SheetTitle className="px-2 text-base">All modules</SheetTitle>
          <SheetDescription className="sr-only">
            Every workspace module, grouped by how often it is used.
          </SheetDescription>
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              document.dispatchEvent(new CustomEvent("open-command-palette"));
            }}
            className="mx-2 mb-3 mt-3 flex h-11 w-[calc(100%-1rem)] items-center gap-2 rounded-control border border-input px-3 text-sm text-muted-foreground transition-colors duration-fast hover:bg-secondary focus-ring"
          >
            <Search className="size-4" aria-hidden />
            Search notes, tasks, posts…
          </button>
          <ModuleGrid
            groups={NAV_GROUPS}
            pathname={pathname}
            onNavigate={() => setMoreOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
