"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  BookText,
  Menu,
  ExternalLink,
  ListTodo,
  LogOut,
  Plus,
  StickyNote,
} from "lucide-react";
import { useSignOutMutation } from "@/store/api/adminApi";
import { useSupabaseSession } from "@/hooks/use-auth-guard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppLauncher } from "./app-launcher";
import { LearningPill } from "./learning-pill";
import { SHELL_LAYOUTS, type ShellLayout } from "./use-shell-layout";
import { activeNavItem } from "./nav-config";
import { requestCreate } from "./create-intent";

/**
 * The admin top bar.
 *
 * This is now the only chrome: the fixed rail is gone, and module navigation
 * is the launcher beside the account menu. The bar carries which page you are
 * on, the active learning session, quick add, the launcher, and the account.
 *
 * Solid and border-anchored rather than a floating pill — an admin panel's
 * chrome should read as part of the frame, not as an object hovering over the
 * content.
 */
export function AdminTopbar({
  layout,
  onChooseLayout,
  /**
   * The launcher is hidden while the rail is up.
   *
   * It was left visible in both arrangements on the reasoning that it is the
   * only surface which lists *and* searches every module — but two navigation
   * controls on screen at once reads as a bug rather than as a choice, and the
   * rail has its own search button into the command palette, so nothing is
   * actually lost.
   */
  showLauncher = true,
  /**
   * Supplied only in the rail arrangement, where a phone needs a way into the
   * drawer. With the launcher, navigation is the same control at every width.
   */
  onOpenSidebar,
}: {
  layout: ShellLayout;
  onChooseLayout: (layout: ShellLayout) => void;
  showLauncher?: boolean;
  onOpenSidebar?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const { session } = useSupabaseSession();
  const [signOut] = useSignOutMutation();

  const current = activeNavItem(pathname);
  const Icon = current?.icon;

  const handleLogout = async () => {
    try {
      await signOut().unwrap();
    } catch {
      // Fall through to login even if the network call fails.
    }
    router.replace("/admin/login");
  };

  return (
    <header className="sticky top-0 z-chrome flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
      {onOpenSidebar && (
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
          className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-ring lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      )}

      {/* The current module, as a label. Not a heading: the page's own
          PageHeader is its one h1, and two made every page ambiguous to a
          screen reader. */}
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="size-4 shrink-0 text-primary" aria-hidden />}
        <p className="truncate text-sm font-semibold">
          {current?.name ?? "Personal OS"}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LearningPill />

        {showLauncher && <AppLauncher />}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/70 focus-ring"
            >
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">Quick add</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Quick add
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => requestCreate("task", router.push)}
            >
              <ListTodo className="mr-2 size-4" aria-hidden /> New task
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => requestCreate("note", router.push)}
            >
              <StickyNote className="mr-2 size-4" aria-hidden /> New note
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => requestCreate("transaction", router.push)}
            >
              <Banknote className="mr-2 size-4" aria-hidden /> New transaction
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => requestCreate("post", router.push)}
            >
              <BookText className="mr-2 size-4" aria-hidden /> New blog post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="rounded-full transition-opacity hover:opacity-80 focus-ring"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {session?.user.email?.[0]?.toUpperCase() ?? "A"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
              {session?.user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/*
              Navigation arrangement, as a per-device preference.
              
              It lives here rather than on the Settings screen because that
              screen is bound to the `site_identity` row and its per-group save
              machinery — this is neither site content nor synced, and putting
              it there would imply both. The right answer genuinely differs
              between a wide monitor and a laptop, which is the whole reason it
              is a choice.
            */}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Navigation
            </DropdownMenuLabel>
            {/*
              A radio group, not menu items with a tick drawn on.

              These were `DropdownMenuItem`s whose only mark of the current
              choice was a `Check` toggled between `opacity-0` and
              `opacity-100` — a 16px glyph beside a two-line row, carrying no
              state anyone could hear. To a screen reader both options read
              identically: two commands, neither of them chosen. To everyone
              else the mark was easy to miss, which is how this was reported.

              `DropdownMenuRadioItem` is what a mutually-exclusive choice is:
              it renders `role="menuitemradio"` with `aria-checked`, so the
              state is spoken as well as drawn. Its own indicator is an 8px
              dot, which is smaller than the tick it replaces — so the label
              carries the weight, in the accent and in bold. Three signals,
              none of which depends on a background that a hover could
              out-shout.
            */}
            <DropdownMenuRadioGroup
              value={layout}
              onValueChange={(value) => onChooseLayout(value as ShellLayout)}
            >
              {SHELL_LAYOUTS.map((option) => (
                <DropdownMenuRadioItem
                  key={option.id}
                  value={option.id}
                  className="items-start data-[state=checked]:font-medium data-[state=checked]:text-primary"
                >
                  <span className="min-w-0">
                    <span className="block">{option.label}</span>
                    {/* Normal weight regardless: the emphasis belongs to the
                        label, and a bolded hint would blunt it. */}
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {option.hint}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">
                <ExternalLink className="mr-2 size-4" aria-hidden />
                Back to portfolio
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 size-4" aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/** Exposed for tests / potential title use. */
