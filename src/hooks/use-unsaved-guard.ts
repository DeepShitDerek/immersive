import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";

/**
 * Ask before leaving a page with unsaved input.
 *
 * Covers closing or reloading the tab, and following a link to another admin
 * page. A link that stays on the same page (Settings moving between its own
 * groups, which keeps every group's edits) is let through. Navigation started
 * from code, such as the command palette, is not seen here.
 */
export function useUnsavedGuard(dirty: boolean): void {
  const confirm = useConfirm();
  const router = useRouter();

  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    // Capture phase on document runs before React's own listener, so the
    // link's router navigation never starts unless the answer is yes.
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      if (link.origin !== window.location.origin) return;
      if (link.pathname === window.location.pathname) return;

      event.preventDefault();
      event.stopPropagation();
      const destination = link.pathname + link.search + link.hash;
      void confirm({
        title: "Leave without saving?",
        description: "Your changes on this page have not been saved.",
        confirmText: "Leave",
        cancelText: "Stay",
        variant: "destructive",
      }).then((leave) => {
        if (leave) router.push(destination);
      });
    };

    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, confirm, router]);
}
