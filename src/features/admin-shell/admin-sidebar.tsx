"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { isActiveNavHref, NAV_GROUPS, type NavItem } from "./nav-config";

function openCommandPalette() {
  document.dispatchEvent(new CustomEvent("open-command-palette"));
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const active = isActiveNavHref(pathname, item.href);

  /*
    The active item is filled with the accent, not tinted with it.

    It was `bg-primary/10` — a ten-percent wash — while an inactive item hovered
    to `bg-secondary`, a full fill. So *pointing at* a module read as louder than
    *being in* it, and across 56 themes that wash is often indistinguishable from
    the rail itself. Two states competing like that leave a reader unable to
    answer "where am I", which is the only question this rail exists to answer.

    A solid fill cannot be out-shouted by a hover, survives the collapsed rail
    where the label is gone, and pairs `primary` with `primary-foreground` — the
    one pairing the contrast test already guarantees in every preset. It also
    replaces the 2px rule that used to mark the active row: at that width, on a
    rail that scrolls, it was doing none of the work its comment claimed.
  */
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors",
        collapsed && "justify-center px-2",
        active
          ? "bg-primary font-medium text-primary-foreground shadow-e1 hover:bg-primary/90"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <item.icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.name}</span>}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.name}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The Personal OS navigation rail.
 *
 * A previous pass removed this in favour of a floating pill bar with a
 * command-palette switcher. That was the wrong instinct: it is a marketing-site
 * pattern applied to an admin tool. An admin panel wants its navigation
 * anchored and always visible, so the whole surface area of the product is
 * legible without opening anything.
 *
 * Collapsible to an icon rail for people who want the width back; the
 * preference persists.
 */
export function AdminSidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col bg-card">
        {/* Brand + collapse */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center gap-2 border-b px-3",
            collapsed && "justify-center px-2",
          )}
        >
          {!collapsed && (
            <Link
              href="/admin"
              onClick={onNavigate}
              className="truncate font-heading text-sm font-bold tracking-tight"
            >
              Personal OS
            </Link>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex size-8 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-ring",
                !collapsed && "ml-auto",
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden />
              )}
            </button>
          )}
        </div>

        {/* Search opens the one overlay rather than duplicating it. */}
        <div className={cn("shrink-0 p-3", collapsed && "px-2")}>
          <button
            type="button"
            onClick={openCommandPalette}
            className={cn(
              "flex w-full items-center gap-2 rounded-control bg-secondary/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary focus-ring",
              collapsed && "justify-center px-2",
            )}
            aria-label="Search and commands"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            {!collapsed && (
              <>
                <span>Search…</span>
                <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>

        <nav
          aria-label="Admin"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink
                      item={item}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </TooltipProvider>
  );
}
