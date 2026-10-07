"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronsUpDown, LayoutTemplate, Plus } from "lucide-react";
import { toast } from "sonner";
import type { PortfolioItem, PortfolioSection } from "@/types";
import {
  useDeletePortfolioItemMutation,
  useDeleteSectionMutation,
  useGetNavLinksAdminQuery,
  useGetPortfolioContentQuery,
  useRescanAssetUsageMutation,
  useSavePortfolioItemMutation,
  useSaveSectionMutation,
  useUpdateItemOrderMutation,
  useUpdateSectionOrderMutation,
} from "@/store/api/adminApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Same reason as the section preview: the layouts load when a page preview
// is opened, not with the module.
const SectionRenderer = dynamic(
  () => import("@/features/sections/section-renderer"),
  { ssr: false },
);
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import {
  EmptyState,
  LoadError,
  LoadingState,
  ManagerWrapper,
  PageHeader,
} from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import type { PathOption, SheetState } from "./content-types";
import { ContentTree, type TreePage } from "./content-tree";
import { SectionDetail } from "./section-detail";
import { SectionEditorSheet } from "./section-editor-sheet";
import { ItemEditorSheet } from "./item-editor-sheet";

/**
 * Admin → Content: a tree of pages and their sections, beside an editor.
 *
 * The tree never leaves the screen, so selecting a section swaps the editor
 * rather than replacing the page — no back step, and no losing your place in a
 * list of fifty sections. The hierarchy in the tree *is* the hierarchy of the
 * public site, which is what makes it navigable: pages contain sections,
 * sections contain items.
 *
 * What the previous structures got wrong, kept here so they are not rebuilt:
 *
 * 1. **Two primary actions.** "New Section" appeared in the page header *and*
 *    again as a full-width button inside the list column, ~200px apart. Now
 *    once in the header, plus a per-page `+` in the tree that pre-fills which
 *    page it lands on.
 *
 * 2. **Pages were invisible.** Sections were primary and pages were only
 *    accordion group headings, so a page was never a thing you could select,
 *    count, or move a section between.
 *
 * 3. **`h-[calc(100vh-13rem)]` on the whole grid.** That magic number broke
 *    whenever the shell header changed height and created nested scroll
 *    regions that fought the page scrollbar. Only the tree is sticky now; the
 *    page scrolls normally.
 *
 * 4. **Creating a section left you where you were.** It now opens what it just
 *    created.
 */
export default function ContentPage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [localSections, setLocalSections] = useState<PortfolioSection[]>([]);

  const {
    data: sections,
    isLoading,
    error,
    refetch,
  } = useGetPortfolioContentQuery();
  const { data: navLinks } = useGetNavLinksAdminQuery();
  const [saveSection] = useSaveSectionMutation();
  const [deleteSection] = useDeleteSectionMutation();
  const [saveItem] = useSavePortfolioItemMutation();
  const [deleteItem] = useDeletePortfolioItemMutation();
  const [updateOrder] = useUpdateSectionOrderMutation();
  const [rescanUsage] = useRescanAssetUsageMutation();
  const [updateItemOrder] = useUpdateItemOrderMutation();
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  useEffect(() => {
    if (sections) setLocalSections(sections);
  }, [sections]);

  // Deletes offer Undo instead of asking first. Nothing is deleted
  // until the toast closes, so a section's items, and the public page, stay
  // as they were if you undo.
  const { pending: deletingSections, remove: removeSection } =
    useUndoableDelete<PortfolioSection>(async (section) => {
      try {
        await deleteSection(section.id).unwrap();
      } catch (err) {
        toast.error("Couldn't delete the section", {
          description: getErrorMessage(err),
        });
      }
    });
  const { pending: deletingItems, remove: removeItem } =
    useUndoableDelete<PortfolioItem>(async (item) => {
      try {
        await deleteItem(item.id).unwrap();
        // Asset usage is a nice-to-have; a failure here must not read as a
        // failed delete.
        rescanUsage()
          .unwrap()
          .catch(() => undefined);
      } catch (err) {
        toast.error("Couldn't delete the item", {
          description: getErrorMessage(err),
        });
      }
    });

  /**
   * What is drawn: the sections less any waiting to be deleted. The reorder
   * handlers keep working on `localSections`, so an Undo puts a row back in
   * its place.
   */
  const shownSections = useMemo(() => {
    if (deletingSections.size === 0 && deletingItems.size === 0)
      return localSections;
    return localSections
      .filter((s) => !deletingSections.has(s.id))
      .map((s) =>
        s.portfolio_items?.some((i) => deletingItems.has(i.id))
          ? {
              ...s,
              portfolio_items: s.portfolio_items.filter(
                (i) => !deletingItems.has(i.id),
              ),
            }
          : s,
      );
  }, [localSections, deletingSections, deletingItems]);

  /** Every path that has content, or that a nav link points at. */
  const pages = useMemo(() => {
    const paths = new Set<string>(["/"]);
    navLinks?.forEach(
      (link) => link.href?.startsWith("/") && paths.add(link.href),
    );
    shownSections.forEach((s) => s.page_path && paths.add(s.page_path));

    return Array.from(paths)
      .sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)))
      .map((path) => {
        const onPage = shownSections.filter((s) => s.page_path === path);
        return {
          path,
          label: path === "/" ? "Home" : path,
          sectionCount: onPage.length,
          hiddenCount: onPage.filter((s) => s.is_visible === false).length,
        };
      });
  }, [navLinks, shownSections]);

  const availablePaths: PathOption[] = useMemo(
    () =>
      pages.map((p) => ({
        label: p.path === "/" ? "/ (home)" : p.path,
        value: p.path,
      })),
    [pages],
  );

  // Land on the first page that actually has content, so the module opens on
  // something rather than on an empty selection.
  useEffect(() => {
    if (selectedPath || pages.length === 0) return;
    setSelectedPath((pages.find((p) => p.sectionCount > 0) ?? pages[0]).path);
  }, [pages, selectedPath]);

  const openSection = shownSections.find((s) => s.id === openSectionId) ?? null;

  // Open on something rather than an empty editor pane.
  useEffect(() => {
    if (openSectionId || shownSections.length === 0) return;
    const first = [...shownSections].sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
    )[0];
    setOpenSectionId(first.id);
  }, [shownSections, openSectionId]);

  /* ── handlers ─────────────────────────────────────────────────────── */

  /** Drop `sectionId` onto `targetSectionId`, taking its position. */
  const handleReorderTo = useCallback(
    async (sectionId: string, targetSectionId: string) => {
      const section = localSections.find((s) => s.id === sectionId);
      const target = localSections.find((s) => s.id === targetSectionId);
      if (!section || !target || section.page_path !== target.page_path) return;

      const samePage = localSections
        .filter((s) => s.page_path === section.page_path)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

      const from = samePage.findIndex((s) => s.id === sectionId);
      const to = samePage.findIndex((s) => s.id === targetSectionId);
      if (from === -1 || to === -1 || from === to) return;

      const reordered = [...samePage];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);

      const previous = localSections;
      setLocalSections((current) =>
        current.map((s) => {
          if (s.page_path !== section.page_path) return s;
          const idx = reordered.findIndex((r) => r.id === s.id);
          return idx === -1 ? s : { ...s, display_order: idx };
        }),
      );

      try {
        await updateOrder(reordered.map((s) => s.id)).unwrap();
      } catch (err) {
        // Roll back to the exact pre-move state rather than the last server
        // payload, which may be staler than what the user was looking at.
        setLocalSections(previous);
        toast.error("Couldn't reorder sections", {
          description: getErrorMessage(err),
        });
      }
    },
    [localSections, updateOrder],
  );

  /**
   * Move a section to another page by dropping it on that page's header.
   *
   * `page_path` is what decides which public route renders a section, so this
   * is a real move, not a reorder — it goes through saveSection rather than
   * update_section_order.
   */
  const handleMoveToPage = useCallback(
    async (sectionId: string, path: string) => {
      const section = localSections.find((s) => s.id === sectionId);
      if (!section || section.page_path === path) return;

      const previous = localSections;
      setLocalSections((current) =>
        current.map((s) =>
          s.id === sectionId ? { ...s, page_path: path } : s,
        ),
      );

      try {
        await saveSection({ id: sectionId, page_path: path }).unwrap();
        toast.success(`Moved to ${path === "/" ? "Home" : path}`);
      } catch (err) {
        setLocalSections(previous);
        toast.error("Couldn't move the section", {
          description: getErrorMessage(err),
        });
      }
    },
    [localSections, saveSection],
  );

  const handleSaveSection = useCallback(
    async (data: Partial<PortfolioSection>, options?: { silent?: boolean }) => {
      try {
        const saved = await saveSection(data).unwrap();
        if (!options?.silent) {
          toast.success(`Section "${saved.title}" saved`);
          setSheetState(null);
          // Creating something selects it: land on the new section rather than
          // returning to an unchanged list the user then has to search.
          setSelectedPath(saved.page_path ?? selectedPath);
          setOpenSectionId(saved.id);
        }
        return saved;
      } catch (err) {
        // Autosave failures must still surface — silent applies to the success
        // path only, never to errors.
        toast.error("Failed to save section", {
          description: getErrorMessage(err),
        });
        throw err;
      }
    },
    [saveSection, selectedPath],
  );

  const handleToggleVisible = useCallback(
    async (section: PortfolioSection) => {
      try {
        await saveSection({
          id: section.id,
          is_visible: !(section.is_visible !== false),
        }).unwrap();
      } catch (err) {
        toast.error("Couldn't change visibility", {
          description: getErrorMessage(err),
        });
      }
    },
    [saveSection],
  );

  const handleDeleteSection = useCallback(
    (id: string) => {
      const target = localSections.find((s) => s.id === id);
      if (!target) return;
      const itemCount = target.portfolio_items?.length ?? 0;
      setOpenSectionId(null);
      removeSection(
        target,
        `Deleted "${target.title || "Untitled section"}"`,
        itemCount > 0
          ? `With its ${itemCount} item${itemCount === 1 ? "" : "s"}. It comes off the site when this closes.`
          : "It comes off the site when this closes.",
      );
    },
    [localSections, removeSection],
  );

  const handleSaveItem = useCallback(
    async (itemData: Partial<PortfolioItem>, sectionId: string) => {
      try {
        await saveItem({ ...itemData, section_id: sectionId }).unwrap();
        toast.success("Item saved");
        setSheetState(null);
        // Asset usage is a nice-to-have; a failure here must not read as a
        // failed save.
        rescanUsage()
          .unwrap()
          .catch(() => undefined);
      } catch (err) {
        toast.error("Failed to save item", {
          description: getErrorMessage(err),
        });
      }
    },
    [rescanUsage, saveItem],
  );

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      const item = localSections
        .flatMap((s) => s.portfolio_items ?? [])
        .find((i) => i.id === itemId);
      if (!item) return;
      removeItem(item, `Deleted "${item.title || "Untitled item"}"`);
    },
    [localSections, removeItem],
  );

  /** Swap an item with its neighbour, optimistically, in one database call. */
  const handleMoveItem = useCallback(
    async (itemId: string, direction: -1 | 1) => {
      const owner = localSections.find((s) =>
        (s.portfolio_items ?? []).some((i) => i.id === itemId),
      );
      if (!owner) return;
      const ordered = [...(owner.portfolio_items ?? [])].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
      );
      const from = ordered.findIndex((i) => i.id === itemId);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= ordered.length) return;

      const reordered = [...ordered];
      [reordered[from], reordered[to]] = [reordered[to], reordered[from]];

      const previous = localSections;
      setLocalSections((current) =>
        current.map((s) =>
          s.id === owner.id
            ? {
                ...s,
                portfolio_items: reordered.map((item, index) => ({
                  ...item,
                  display_order: index + 1,
                })),
              }
            : s,
        ),
      );

      try {
        await updateItemOrder({
          sectionId: owner.id,
          itemIds: reordered.map((item) => item.id),
        }).unwrap();
      } catch (err) {
        setLocalSections(previous);
        toast.error("Couldn't reorder items", {
          description: getErrorMessage(err),
        });
      }
    },
    [localSections, updateItemOrder],
  );

  /* ── sheets ───────────────────────────────────────────────────────── */

  const sheet = (() => {
    if (!sheetState) return null;
    if (sheetState.type === "new-section" || sheetState.type === "edit-section")
      return (
        <SectionEditorSheet
          section={
            sheetState.type === "edit-section"
              ? sheetState.section
              : // A new section starts on the page you are looking at, rather
                // than making you choose a path you have already chosen.
                ({
                  page_path: selectedPath ?? "/",
                } as Partial<PortfolioSection>)
          }
          availablePaths={availablePaths}
          onSave={handleSaveSection}
          onClose={() => setSheetState(null)}
        />
      );
    return (
      <ItemEditorSheet
        item={sheetState.type === "edit-item" ? sheetState.item : null}
        sectionId={
          sheetState.type === "new-item"
            ? sheetState.sectionId
            : (sheetState.item.section_id ?? "")
        }
        layoutStyle={openSection?.layout_style ?? "default"}
        siblings={openSection?.portfolio_items ?? []}
        onSave={handleSaveItem}
        onClose={() => setSheetState(null)}
      />
    );
  })();

  /* ── render ───────────────────────────────────────────────────────── */

  const treePages: TreePage[] = useMemo(
    () =>
      pages.map((p) => ({
        path: p.path,
        label: p.label,
        sections: shownSections
          .filter((s) => s.page_path === p.path)
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
      })),
    [pages, shownSections],
  );

  const tree = (
    <ContentTree
      pages={treePages}
      selectedSectionId={openSectionId}
      onSelectSection={(id) => {
        setOpenSectionId(id);
        setTreeOpen(false);
      }}
      onNewSection={(path) => {
        setSelectedPath(path);
        setSheetState({ type: "new-section" });
      }}
      onReorder={handleReorderTo}
      onMoveToPage={handleMoveToPage}
      onPreviewPage={(path) => {
        setPreviewPath(path);
        setTreeOpen(false);
      }}
    />
  );

  const previewSections = previewPath
    ? shownSections
        .filter((s) => s.page_path === previewPath && s.is_visible !== false)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    : [];

  /** The whole page, as the site draws it — hidden sections left out. */
  const pagePreview = (
    <Dialog
      open={!!previewPath}
      onOpenChange={(open) => !open && setPreviewPath(null)}
    >
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {previewPath === "/" ? "Home" : previewPath}, as visitors see it
          </DialogTitle>
          <DialogDescription>
            Drawn by the site itself. Hidden sections are left out.{" "}
            {previewPath && (
              <a
                href={previewPath}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2"
              >
                Open the live page
              </a>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-16 rounded-surface bg-background p-5 sm:p-8">
          {previewSections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No visible sections on this page yet.
            </p>
          ) : (
            previewSections.map((s) => (
              <SectionRenderer key={s.id} section={s} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) {
    return (
      <ManagerWrapper>
        <PageHeader title="Pages" />
        <LoadingState label="Loading content" />
      </ManagerWrapper>
    );
  }

  // The shared error state, with the reason and a Retry, like every module.
  // Only when there is nothing to show: a failed refetch keeps the last copy.
  if (error && localSections.length === 0) {
    return (
      <ManagerWrapper>
        <PageHeader title="Pages" />
        <LoadError what="the pages" error={error} onRetry={refetch} />
      </ManagerWrapper>
    );
  }

  if (shownSections.length === 0) {
    return (
      <ManagerWrapper>
        <PageHeader
          title="Pages"
          actions={
            <Button onClick={() => setSheetState({ type: "new-section" })}>
              <Plus className="mr-2 size-4" aria-hidden /> New section
            </Button>
          }
        />
        <EmptyState
          variant="card"
          icon={LayoutTemplate}
          title="No content yet"
          description="Sections are the building blocks of every public page. Create your first one to get started."
          action={{
            label: "New section",
            onClick: () => setSheetState({ type: "new-section" }),
            icon: Plus,
          }}
        />
        {sheet}
      </ManagerWrapper>
    );
  }

  return (
    <ManagerWrapper>
      <PageHeader
        title="Pages"
        description="Every public page is built from sections. Pick one to edit it, or preview a whole page."
        actions={
          <Button onClick={() => setSheetState({ type: "new-section" })}>
            <Plus className="mr-2 size-4" aria-hidden /> New section
          </Button>
        }
      />

      {/*
        Two panes, but the page still scrolls. The tree is `sticky` with its own
        overflow rather than the whole grid being pinned to a
        `h-[calc(100vh-13rem)]` box — that is what previously created nested
        scroll regions fighting the page scrollbar, and it broke whenever the
        shell header changed height.
      */}
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Mobile: the same tree, in a sheet. One model at both widths — pick a
            section, edit it; only the chooser's presentation differs. */}
        <div className="lg:hidden">
          <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="truncate">
                  {openSection?.title ?? "Choose a section"}
                </span>
                <ChevronsUpDown className="size-4 shrink-0" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetTitle className="mb-4">Pages &amp; sections</SheetTitle>
              {tree}
            </SheetContent>
          </Sheet>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-surface border bg-card p-2">
            {tree}
          </div>
        </aside>

        <div className="min-w-0">
          {openSection ? (
            <SectionDetail
              section={openSection}
              onMoveItem={handleMoveItem}
              onEditSection={(section) =>
                setSheetState({ type: "edit-section", section })
              }
              onDeleteSection={handleDeleteSection}
              onToggleVisible={handleToggleVisible}
              onSaveContent={handleSaveSection}
              onNewItem={(sectionId) =>
                setSheetState({ type: "new-item", sectionId })
              }
              onEditItem={(item) => setSheetState({ type: "edit-item", item })}
              onDeleteItem={handleDeleteItem}
            />
          ) : (
            <EmptyState
              variant="card"
              icon={LayoutTemplate}
              title="Choose a section"
              description="Pick a section from the tree to edit its content and items."
            />
          )}
        </div>
      </div>

      {sheet}
      {pagePreview}
    </ManagerWrapper>
  );
}
