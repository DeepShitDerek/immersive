"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  isActiveNavHref,
  NAV_GROUPS,
  type NavGroup,
  type NavItem,
} from "./nav-config";

/**
 * Every module, as a grid.
 *
 * **Why this replaces the rail.** The rail spent 15rem of every screen on a
 * list of eighteen destinations, of which you use one at a time — and it is
 * always the same eighteen, so after a week it is furniture you have stopped
 * reading. A launcher gives that width back to the work and treats the modules
 * as what they are: separate applications you switch between, not sections of
 * one page you scroll through.
 *
 * It is also what `CLAUDE.md` has described the shell as all along. The rail
 * was reintroduced at some point against that rule, and nothing caught it
 * because the design gate only checks class names.
 *
 * **One navigation surface, not two.** The architecture forbids a second
 * navigation overlay, so the search is *inside* this panel rather than being a
 * separate palette to learn. The existing `CommandPalette` stays as the
 * keyboard route to the same list — same `NAV_GROUPS`, so the two cannot drift
 * — but nothing else opens it, and it is no longer the only way to see what
 * exists.
 *
 * **Filtering, not fuzzy matching.** Eighteen names is a list you can read; a
 * fuzzy matcher that ranks "Finance" above "Navigation" for the query "na"
 * would be cleverness nobody asked for on a set this small.
 */
export function AppLauncher() {
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset on close, or reopening lands you in the middle of the last search.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return NAV_GROUPS;

    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.name.toLowerCase().includes(term),
      ),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  const matches = groups.flatMap((group) => group.items);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="All modules"
          aria-expanded={open}
          className="flex size-9 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-ring"
        >
          <LayoutGrid className="size-5" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
        onOpenAutoFocus={(event) => {
          // Focus the field rather than the first tile: typing is the fastest
          // route once you know the name, and arrowing to a tile is still one
          // key away.
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a module…"
              aria-label="Find a module"
              className="h-9 pl-8"
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches.length === 1) {
                  // One match and Enter is the whole keyboard flow: type three
                  // letters, press Enter, you are there.
                  event.preventDefault();
                  document
                    .querySelector<HTMLAnchorElement>("[data-launcher-tile]")
                    ?.click();
                }
              }}
            />
          </div>
        </div>

        <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
          {groups.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          ) : (
            <ModuleGrid
              groups={groups}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The grouped tiles, shared by this launcher and the phone tab bar's "More"
 * sheet, so the two lists cannot disagree.
 */
export function ModuleGrid({
  groups,
  pathname,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.label} className="mb-2 last:mb-0">
          <h3 className="t-eyebrow px-2 pb-1.5 pt-1">{group.label}</h3>
          <ul className="grid grid-cols-3 gap-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <LauncherTile
                  item={item}
                  active={isActiveNavHref(pathname, item.href)}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function LauncherTile({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      data-launcher-tile
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-control px-1 py-3 text-center transition-colors",
        "focus-ring",
        // Filled, not tinted — and the same fill the rail uses, because the two
        // are the same answer to the same question and must not disagree about
        // what "you are here" looks like. See the note in admin-sidebar.tsx.
        active
          ? "bg-primary font-medium text-primary-foreground shadow-e1 hover:bg-primary/90"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <item.icon className="size-5 shrink-0" aria-hidden />
      {/*
        `break-words` as well as the small size: "Whiteboard" and "Navigation"
        are wider than a third of a 24rem panel, and a clipped module name is
        a module you cannot find.
      */}
      <span className="w-full break-words text-micro font-medium leading-tight">
        {item.name}
      </span>
    </Link>
  );
}
