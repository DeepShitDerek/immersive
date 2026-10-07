"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FocusTimer } from "@/features/focus/focus-timer";
import { LearningSessionManager } from "@/features/learning/learning-session-manager";
import { CommandPalette } from "./command-palette";
import { KeyboardMap } from "./keyboard-map";
import { cn } from "@/lib/cn";
import { useAdminGuard } from "./use-admin-guard";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";
import { activeNavItem } from "./nav-config";
import { useShellLayout } from "./use-shell-layout";
import { WorkspaceTabBar } from "./workspace-tab-bar";

const COLLAPSE_KEY = "admin_sidebar_collapsed";

function useDocumentTitle() {
  const pathname = usePathname() ?? "/admin";
  useEffect(() => {
    const item = activeNavItem(pathname);
    document.title = item ? `${item.name} · Personal OS` : "Personal OS";
  }, [pathname]);
}

function ShellLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-[100dvh] items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Authorizing…</p>
      </div>
    </div>
  );
}

/**
 * The guarded Personal OS shell, in whichever arrangement the owner chose.
 *
 * **This project argued itself round the same loop three times** — rail, then a
 * floating pill bar with navigation behind a keystroke, then the rail again,
 * then the launcher — and defended each answer as the correct one. That is
 * usually the sign that there is no single correct one. A rail is worth its
 * 15rem on a wide monitor where the space is free and costs a sixth of the
 * screen on a laptop, so it is a preference now, stored per device.
 *
 * Both arrangements share `NAV_GROUPS` and `isActiveNavHref`, so they cannot
 * disagree about what exists or about which module you are in — which is the
 * failure that would make having two of them expensive.
 *
 * The launcher is the default, because it works at every width; the rail
 * assumes there is room for it. See `use-shell-layout.ts`.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { state } = useAdminGuard();
  const { layout, choose, ready } = useShellLayout();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useDocumentTitle();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "true");
    } catch {
      // Blocked site data; uncollapsed is the safe default.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // As above — the choice still applies for this session.
      }
      return next;
    });
  };

  if (state !== "authorized") return <ShellLoading />;

  /**
   * The rail waits for the stored preference.
   *
   * `localStorage` cannot be read during render — it does not exist on the
   * server, and this app's HTML is written at build time — so rendering the
   * rail before the preference is known would flash it in and out on every
   * page load for anyone who chose the launcher.
   */
  const railed = ready && layout === "sidebar";

  return (
    <div
      className={cn(
        "min-h-[100dvh] bg-secondary/30",
        !railed && "flex flex-col",
      )}
    >
      <FocusTimer />
      <LearningSessionManager />
      <CommandPalette />
      <KeyboardMap />

      {railed && (
        <>
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-rail hidden border-r lg:block",
              collapsed ? "w-16" : "w-60",
            )}
          >
            <AdminSidebar
              collapsed={collapsed}
              onToggleCollapse={toggleCollapsed}
            />
          </aside>

          {/* The same component in the drawer, so navigation is identical. */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <AdminSidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </>
      )}

      <div
        className={cn(
          "flex min-h-[100dvh] flex-col",
          railed && (collapsed ? "lg:pl-16" : "lg:pl-60"),
        )}
      >
        {/*
          The layout state is owned here and passed down, not read again in the
          bar.
          
          `useShellLayout` was called in both places, which meant two
          independent `useState`s over the same key: choosing in the bar
          updated the bar's copy and the shell never heard about it, so the
          arrangement only changed on the next reload. One owner, one value.
        */}
        <AdminTopbar
          layout={layout}
          onChooseLayout={choose}
          showLauncher={!railed}
          onOpenSidebar={railed ? () => setMobileOpen(true) : undefined}
        />
        {/* Below lg the tab bar is fixed to the bottom, so the page keeps
            its height clear of it. */}
        <main className="flex-1 px-4 pb-[calc(var(--tabbar-h)+1.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:pb-6">
          <div className="mx-auto w-full max-w-wide">{children}</div>
        </main>
      </div>
      <WorkspaceTabBar />
    </div>
  );
}
