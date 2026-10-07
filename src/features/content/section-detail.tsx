"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  ImageOff,
  Info,
  LayoutTemplate,
  Link as LinkIcon,
  MoreHorizontal,
  PenLine,
  Plus,
  Settings2,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { PortfolioItem, PortfolioSection } from "@/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EmptyState,
  SaveStatus,
  type SaveState,
} from "@/components/admin/shared";
import NovelEditor from "@/components/admin/novel-editor";
/**
 * The public renderer pulls in every section layout — ~100 kB that the edit
 * view never needs. Loaded when a preview is actually asked for.
 */
const SectionRenderer = dynamic(
  () => import("@/features/sections/section-renderer"),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Drawing the preview…</p>
    ),
  },
);
import { LAYOUT_OPTIONS } from "./layout-registry";
import { safeImageUrl, safeLinkUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";

export interface SectionDetailProps {
  section: PortfolioSection | null;
  onEditSection: (section: PortfolioSection) => void;
  onDeleteSection: (id: string) => void;
  /** Show or hide the section on the public site. */
  onToggleVisible: (section: PortfolioSection) => void;
  onSaveContent: (
    data: { id: string; content: string },
    options?: { silent?: boolean },
  ) => Promise<unknown> | void;
  onNewItem: (sectionId: string) => void;
  onEditItem: (item: PortfolioItem) => void;
  onDeleteItem: (itemId: string) => void;
  /** Swap an item with its neighbour. */
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
}

const AUTOSAVE_DELAY = 1200;

/**
 * What each shared item field means in a given layout. The item editor has
 * five generic fields and every layout reads them differently; the section
 * says so rather than leaving it to the layout's name.
 */
const FIELD_HINTS: Record<string, string> = {
  "stats-grid": "Title = the number. Subtitle = its label.",
  "impact-numbers": "Title = the number. Subtitle = its label.",
  testimonials:
    "Title = the quote. Subtitle = who said it. Description = their role. Image = avatar.",
  "work-experience":
    "Title = role. Subtitle = company. Image = company logo. Dates drive the range.",
  "case-study":
    "Description carries the write-up — markdown works. Image = hero.",
  services: "Tags render as a checklist of what's included.",
  process:
    "Title = the step. Subtitle = how long it takes. Description = what happens.",
  faq: "Title = the question. Description = the answer.",
  uses: "Subtitle is the group heading — items sharing one are grouped together.",
  "client-logos": "Image = the logo. Without one, the title is shown as text.",
  "open-source": "Title = repository name. Subtitle = the star or meta line.",
  speaking: "Subtitle = the kind (Talk, Podcast, Workshop…).",
  "compact-cards": "Only title and subtitle are shown.",
  "press-awards": "Only title and subtitle are shown.",
  "now-page": "Subtitle = the category label above each entry.",
  masonry: "Led by images. Items without one get a placeholder tile.",
  "cards-with-image": "The image sits above the text.",
  "feature-alternating": "Subtitle doubles as the eyebrow above the title.",
  "github-grid":
    "Fetches your repositories from GitHub. Items here are ignored.",
  highlight:
    "Shows one of your public Library highlights at random. Items here are ignored.",
};

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: "warn" | "danger" | "info";
  icon: typeof Info;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-control px-3.5 py-3 text-sm",
        tone === "warn" && "bg-warning/10",
        tone === "danger" && "bg-destructive/10",
        tone === "info" && "bg-secondary/60",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "warn" && "text-warning",
          tone === "danger" && "text-destructive",
          tone === "info" && "text-muted-foreground",
        )}
        aria-hidden
      />
      <p className="min-w-0 text-muted-foreground">{children}</p>
    </div>
  );
}

function pageLabel(path: string): string {
  return path === "/" ? "Home" : path;
}

/**
 * One section of a public page: what it is, its content or items, and — one
 * click away — how it looks on the site, drawn by the site's own renderer.
 *
 * The preview is the point. Choosing a layout and filling five generic fields
 * used to mean saving, opening the site in another tab, and finding the
 * section; now the same component the visitor sees renders here, from what is
 * being edited.
 */
export function SectionDetail({
  section,
  onEditSection,
  onDeleteSection,
  onToggleVisible,
  onSaveContent,
  onNewItem,
  onEditItem,
  onDeleteItem,
  onMoveItem,
}: SectionDetailProps) {
  const [content, setContent] = useState(section?.content ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [view, setView] = useState<"edit" | "preview">("edit");

  // The callback lives in a ref so the autosave timer depends only on content.
  const saveRef = useRef(onSaveContent);
  useEffect(() => {
    saveRef.current = onSaveContent;
  }, [onSaveContent]);

  const savedRef = useRef(section?.content ?? "");
  const sectionIdRef = useRef(section?.id);
  // The latest text, for saves that run outside a render.
  const contentRef = useRef(content);
  contentRef.current = content;
  // Saves run one after another, so an older response can never land last.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * Save what is pending for the section open *now*. Reads refs, so it is
   * stable: the autosave timer, a section switch and leaving the page all
   * call the same function without re-subscribing on every keystroke.
   */
  const flush = useCallback(() => {
    const id = sectionIdRef.current;
    const pending = contentRef.current;
    if (!id || pending === savedRef.current) return queueRef.current;
    queueRef.current = queueRef.current.then(async () => {
      setSaveState("saving");
      try {
        await saveRef.current({ id, content: pending }, { silent: true });
        // Only if this is still the section on screen; a save for the one
        // just left must not overwrite the new section's saved text.
        if (sectionIdRef.current === id) {
          savedRef.current = pending;
          setSaveState(contentRef.current === pending ? "saved" : "dirty");
        }
      } catch {
        setSaveState("error");
      }
    });
    return queueRef.current;
  }, []);

  useEffect(() => {
    if (section?.id === sectionIdRef.current) return;
    // Switching sections: save the one being left first. `flush` reads the
    // refs, which still hold its id and text.
    void flush();
    sectionIdRef.current = section?.id;
    setContent(section?.content ?? "");
    contentRef.current = section?.content ?? "";
    savedRef.current = section?.content ?? "";
    setSaveState("idle");
  }, [section?.id, section?.content, flush]);

  // Save once typing pauses.
  useEffect(() => {
    if (!section || section.type !== "markdown") return;
    if (content === savedRef.current) return;
    setSaveState("dirty");
    const handle = setTimeout(() => void flush(), AUTOSAVE_DELAY);
    return () => clearTimeout(handle);
  }, [content, flush, section]);

  /**
   * Never lose a pending edit: ask before a tab closes, and save on leaving.
   * Registered once. It used to depend on `content`, so its cleanup — a save —
   * ran on every keystroke and the debounce above never had a chance.
   */
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (contentRef.current !== savedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      void flush();
    };
  }, [flush]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const handle = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(handle);
  }, [saveState]);

  const layoutMeta = useMemo(
    () => LAYOUT_OPTIONS.find((o) => o.value === section?.layout_style),
    [section?.layout_style],
  );

  if (!section) {
    return (
      <EmptyState
        variant="card"
        icon={LayoutTemplate}
        title="Choose a section"
        description="Pick a section from the pages on the left to edit it."
      />
    );
  }

  const isMarkdown = section.type === "markdown";
  const isHidden = section.is_visible === false;
  const items = [...(section.portfolio_items ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const hint = section.layout_style
    ? FIELD_HINTS[section.layout_style]
    : undefined;
  const unknownLayout = !isMarkdown && !layoutMeta;
  const kind = isMarkdown
    ? "Written text"
    : (layoutMeta?.label ?? section.layout_style);

  return (
    <div className="rounded-surface border bg-card">
      {/*
        The section's header, in the order you scan it: where it is and what it is, its name, then whether it is on
        the site — a switch that says so in words — the live page, and the
        rest behind ⋯. Five icon buttons with tooltips were the only way in.
      */}
      <header className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{pageLabel(section.page_path)}</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => onEditSection(section)}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-foreground transition-colors hover:bg-secondary focus-ring"
              aria-label={`Layout: ${kind}. Change it in section settings`}
            >
              <LayoutTemplate className="size-3" aria-hidden />
              {kind}
            </button>
          </p>
          <h2 className="mt-1.5 break-words font-heading text-2xl font-semibold tracking-tight">
            {section.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="View"
            className="flex rounded-control bg-secondary p-0.5"
          >
            {(["edit", "preview"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className={cn(
                  "flex items-center gap-1.5 rounded-[calc(var(--r-control)-2px)] px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-ring",
                  view === mode
                    ? "bg-card text-foreground shadow-e1"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode === "edit" ? (
                  <PenLine className="size-3.5" aria-hidden />
                ) : (
                  <Eye className="size-3.5" aria-hidden />
                )}
                {mode === "edit" ? "Edit" : "Preview"}
              </button>
            ))}
          </div>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-control border px-2.5 text-sm">
            <Switch
              checked={!isHidden}
              onCheckedChange={() => onToggleVisible(section)}
              aria-label="Shown on the site"
            />
            <span
              className={isHidden ? "text-muted-foreground" : "text-foreground"}
            >
              {isHidden ? "Hidden" : "On the site"}
            </span>
          </label>
          <Button variant="outline" size="sm" className="h-9" asChild>
            <a
              href={section.page_path}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4 sm:mr-1.5" aria-hidden />
              <span className="sr-only sm:not-sr-only">View on site</span>
            </a>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="More actions for this section"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => onEditSection(section)}>
                <Settings2 className="mr-2 size-4" aria-hidden /> Section
                settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDeleteSection(section.id)}
              >
                <Trash2 className="mr-2 size-4" aria-hidden /> Delete section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="space-y-5 px-5 pb-6 sm:px-6">
        {isHidden && (
          <Notice tone="warn" icon={EyeOff}>
            Hidden sections are not drawn on {pageLabel(section.page_path)}.
            Their items can still be read through the public API.
          </Notice>
        )}
        {unknownLayout && (
          <Notice tone="danger" icon={AlertTriangle}>
            The layout “{section.layout_style}” has no renderer, so the site
            falls back to a plain list. Choose one in Section settings.
          </Notice>
        )}

        {view === "preview" ? (
          <div className="rounded-surface bg-background p-5 sm:p-8">
            <p className="mb-6 text-xs text-muted-foreground">
              As it looks on {pageLabel(section.page_path)} — drawn by the site
              itself{isHidden ? ", though hidden for now" : ""}.
            </p>
            <SectionRenderer
              section={{ ...section, content, portfolio_items: items }}
            />
          </div>
        ) : isMarkdown ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Content</p>
              <SaveStatus
                state={saveState}
                text={
                  saveState === "error"
                    ? "Couldn't save — retrying on your next edit"
                    : undefined
                }
              />
            </div>
            {/* No fixed height and not clipped: the editor grows with the
                section, and its block handle sits in the left padding. */}
            <div className="rounded-control bg-background/60 px-4 py-3 md:pl-14">
              <NovelEditor
                value={content}
                onChange={setContent}
                placeholder="Write this section — '/' for blocks…"
                minHeight="18rem"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Saves as you type. Raw HTML is escaped on the public site.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {hint && (
              <Notice tone="info" icon={Info}>
                {hint}
              </Notice>
            )}

            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-baseline gap-2 text-base font-semibold">
                Items{" "}
                <span className="text-sm font-normal tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </h3>
              <Button size="sm" onClick={() => onNewItem(section.id)}>
                <Plus className="mr-1.5 size-4" aria-hidden />
                Add item
              </Button>
            </div>

            {items.length === 0 ? (
              <EmptyState
                size="compact"
                variant="bordered"
                icon={LayoutTemplate}
                title="No items yet"
                description={`This section shows as ${
                  layoutMeta?.label ?? section.layout_style
                } once it has an item. Until then the site skips it.`}
                action={{
                  label: "Add the first item",
                  onClick: () => onNewItem(section.id),
                  icon: Plus,
                }}
              />
            ) : (
              <ol className="space-y-1">
                {items.map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    first={index === 0}
                    last={index === items.length - 1}
                    onEdit={() => onEditItem(item)}
                    onDelete={() => onDeleteItem(item.id)}
                    onMove={(direction) => onMoveItem(item.id, direction)}
                  />
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  first,
  last,
  onEdit,
  onDelete,
  onMove,
}: {
  item: PortfolioItem;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const image = safeImageUrl(item.image_url);
  const link = safeLinkUrl(item.link_url);
  const blockedImage = !!item.image_url && !image;
  const blockedLink = !!item.link_url && !link;
  const dates =
    item.date_from || item.date_to
      ? item.date_from
        ? `${item.date_from} – ${item.date_to || "Present"}`
        : `Until ${item.date_to}`
      : null;
  const tags = item.tags?.filter(Boolean) ?? [];

  return (
    <li className="flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-secondary/40">
      <div className="flex shrink-0 flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          disabled={first}
          aria-label={`Move ${item.title} up`}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          disabled={last}
          aria-label={`Move ${item.title} down`}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-3.5" />
        </Button>
      </div>

      {(image || blockedImage) && (
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-control bg-secondary">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <ImageOff
              className="size-4 text-destructive"
              aria-label="Image address blocked — not an http(s) image"
            />
          )}
        </span>
      )}

      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 rounded-control text-left focus-ring"
      >
        <span className="line-clamp-1 break-words font-medium text-foreground">
          {item.title}
        </span>
        {item.subtitle && (
          <span className="line-clamp-1 text-sm text-muted-foreground">
            {item.subtitle}
          </span>
        )}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {dates && <span>{dates}</span>}
          {link && (
            <span className="inline-flex items-center gap-1">
              <LinkIcon className="size-3" aria-hidden /> Link
            </span>
          )}
          {blockedLink && (
            <span className="inline-flex items-center gap-1 text-destructive">
              <LinkIcon className="size-3" aria-hidden /> Link blocked
            </span>
          )}
          {tags.length > 0 && (
            <span>
              {tags.length} {tags.length === 1 ? "tag" : "tags"}
            </span>
          )}
          {item.internal_notes && (
            <span
              className="inline-flex items-center gap-1"
              title={item.internal_notes}
            >
              <StickyNote className="size-3" aria-hidden /> Notes
            </span>
          )}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={`More actions for ${item.title}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onEdit}>
            <PenLine className="mr-2 size-4" aria-hidden /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            <Trash2 className="mr-2 size-4" aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
