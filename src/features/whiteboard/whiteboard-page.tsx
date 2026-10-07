"use client";

import { useUrlParam } from "@/hooks/use-url-param";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Pin, PinOff, Plus, Presentation, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Whiteboard } from "@/types";
import {
  useDeleteWhiteboardMutation,
  useGetWhiteboardsQuery,
  useSaveWhiteboardMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  DocumentCard,
  EmptyState,
  LoadError,
  LoadingState,
  ManagerWrapper,
  NewDocumentCard,
  PageHeader,
} from "@/components/admin/shared";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import { getErrorMessage } from "@/lib/utils";
import { BoardEditor } from "./board-editor";

/** One empty list for every render while the query has none (see Navigation). */
const NO_BOARDS: Whiteboard[] = [];

/**
 * The thumbnail goes through an `<img>` data URL rather than injected markup:
 * an SVG in an `<img>` cannot run script or fetch anything, so a stored
 * preview stays inert whatever produced it.
 */
function previewSrc(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function BoardThumbnail({ board }: { board: Whiteboard }) {
  return board.preview ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={previewSrc(board.preview)}
      alt=""
      className="size-full object-contain"
    />
  ) : (
    <span className="flex size-full items-center justify-center">
      <Presentation className="size-6 text-muted-foreground" aria-hidden />
    </span>
  );
}

export default function WhiteboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  // The open board lives in the URL, "new" for one not yet saved.
  const [boardParam, setBoardParam] = useUrlParam("board", "replace");
  const editingId = boardParam === "new" ? null : boardParam;

  const {
    data: allBoards = NO_BOARDS,
    isLoading,
    error: loadError,
    refetch,
  } = useGetWhiteboardsQuery();
  const [saveWhiteboard] = useSaveWhiteboardMutation();
  const [deleteWhiteboard] = useDeleteWhiteboardMutation();

  // Delete offers Undo instead of asking first.
  const { pending: deleting, remove: removeBoard } =
    useUndoableDelete<Whiteboard>(async (board) => {
      try {
        await deleteWhiteboard(board.id).unwrap();
      } catch (err: unknown) {
        toast.error("Couldn't delete the board", {
          description: getErrorMessage(err),
        });
      }
    });

  // The query already sorts pinned first, newest first; this only filters.
  const boards = useMemo(() => {
    const live = deleting.size
      ? allBoards.filter((b) => !deleting.has(b.id))
      : allBoards;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return live;
    return live.filter(
      (board) =>
        board.title?.toLowerCase().includes(term) ||
        board.tags?.some((tag) => tag.toLowerCase().includes(term)),
    );
  }, [allBoards, deleting, searchTerm]);

  const handleCreate = () => setBoardParam("new");

  const handleRename = async (board: Whiteboard, title: string) => {
    try {
      await saveWhiteboard({ id: board.id, title }).unwrap();
    } catch (err: unknown) {
      toast.error("Couldn't rename the board", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleTogglePin = async (board: Whiteboard) => {
    try {
      await saveWhiteboard({
        id: board.id,
        is_pinned: !board.is_pinned,
      }).unwrap();
    } catch (err: unknown) {
      toast.error("Couldn't change the pin", {
        description: getErrorMessage(err),
      });
    }
  };

  const header = (
    <PageHeader
      title="Whiteboard"
      description="Sketch, diagram, and think out loud."
      actions={
        <Button onClick={handleCreate}>
          <Plus className="mr-2 size-4" aria-hidden /> New board
        </Button>
      }
      searchValue={searchTerm}
      onSearch={setSearchTerm}
      searchPlaceholder="Search boards…"
    />
  );

  const editor = boardParam !== null && (
    // Mounted only while open, so the Excalidraw chunk is never fetched by
    // someone just browsing the gallery. Keyed by what was opened: a blank
    // board's id arriving in the URL must not remount it.
    <BoardEditor
      key={boardParam === "new" ? "new" : "open"}
      boardId={editingId}
      onClose={() => setBoardParam(null)}
      onCreated={(id) => setBoardParam(id)}
    />
  );

  if (loadError && !allBoards.length) {
    return (
      <ManagerWrapper>
        {header}
        <LoadError
          what="your whiteboards"
          error={loadError}
          onRetry={refetch}
        />
      </ManagerWrapper>
    );
  }

  if (isLoading && !allBoards.length) {
    return (
      <ManagerWrapper>
        {header}
        <LoadingState label="Loading your boards" />
        {editor}
      </ManagerWrapper>
    );
  }

  return (
    <ManagerWrapper>
      {header}

      {boards.length === 0 && (searchTerm || allBoards.length > 0) ? (
        <EmptyState
          icon={Presentation}
          title="No board matches"
          description="Try a different search."
          variant="bordered"
        />
      ) : allBoards.length === 0 ? (
        <EmptyState
          icon={Presentation}
          variant="card"
          title="No boards yet"
          description="A blank canvas for sketches, diagrams and handwriting. It saves as you draw."
          action={{ label: "New board", onClick: handleCreate, icon: Plus }}
        />
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!searchTerm && (
            <li>
              <NewDocumentCard label="New board" onClick={handleCreate} />
            </li>
          )}
          {boards.map((board) => (
            <li key={board.id}>
              <DocumentCard
                title={board.title}
                untitled="Untitled board"
                thumbnail={<BoardThumbnail board={board} />}
                meta={
                  board.updated_at
                    ? `Edited ${formatDistanceToNow(new Date(board.updated_at), { addSuffix: true })}`
                    : undefined
                }
                pinned={!!board.is_pinned}
                onOpen={() => setBoardParam(board.id)}
                onRename={(title) => void handleRename(board, title)}
                menuItems={
                  <>
                    <DropdownMenuItem
                      onSelect={() => void handleTogglePin(board)}
                    >
                      {board.is_pinned ? (
                        <PinOff className="mr-2 size-4" aria-hidden />
                      ) : (
                        <Pin className="mr-2 size-4" aria-hidden />
                      )}
                      {board.is_pinned ? "Unpin" : "Pin"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() =>
                        removeBoard(
                          board,
                          `Deleted "${board.title || "Untitled board"}"`,
                        )
                      }
                    >
                      <Trash2 className="mr-2 size-4" aria-hidden /> Delete
                    </DropdownMenuItem>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {editor}
    </ManagerWrapper>
  );
}
