"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  FolderPlus,
  ImageOff,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Move,
  RefreshCw,
  Trash2,
  Upload,
  Globe,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import {
  useAddAssetMutation,
  useDeleteAssetMutation,
  useGetAssetsQuery,
  useMoveAssetMutation,
  useUpdateAssetMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import {
  EmptyState,
  LoadingState,
  ManagerWrapper,
  PageHeader,
} from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import {
  BUCKET_NAME,
  PLACEHOLDER_FILENAME,
  assetsInUse,
  getAllFolderPaths,
  getAssetsForPath,
  sanitizeFolderName,
  targetPathForMove,
  type StorageAsset,
} from "./asset-utils";
import { useAssetOperations } from "./use-asset-operations";
import { AssetBreadcrumbs } from "./asset-breadcrumbs";
import { AssetGrid, AssetTable, FolderGrid } from "./asset-views";
import { CreateFolderDialog, MoveAssetsDialog } from "./folder-dialogs";
import { AssetDetailsSheet } from "./asset-details-sheet";
import { UploadQueue } from "./upload-queue";

/** "3 assets" / "1 asset" — the count appears in several confirm bodies. */
function pluralAssets(count: number): string {
  return `${count} asset${count === 1 ? "" : "s"}`;
}

/**
 * Names the content that references a set of assets, for a confirm body.
 *
 * `used_in` is what the `update_asset_usage` RPC last recorded — it matches
 * blog covers, blog content and portfolio items by path substring. It is the
 * only signal available that a delete or a move will break a live page, and
 * until now nothing in this screen used it for anything but a small badge.
 */
function describeUsage(assets: StorageAsset[]): string {
  const inUse = assetsInUse(assets);
  if (inUse.length === 0) return "";
  const places = new Set<string>();
  for (const asset of inUse) {
    for (const use of asset.used_in ?? []) places.add(use.type);
  }
  const where = Array.from(places).sort().join(", ");
  return `${pluralAssets(inUse.length)} ${inUse.length === 1 ? "is" : "are"} still referenced by published content (${where}).`;
}

export default function AssetsPage() {
  const confirm = useConfirm();
  const [selectedAsset, setSelectedAsset] = useState<StorageAsset | null>(null);

  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(
    new Set(),
  );
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [targetMoveFolder, setTargetMoveFolder] = useState<string>("root");

  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  const { data: assets = [], isLoading } = useGetAssetsQuery();
  const [addAsset] = useAddAssetMutation();
  const [updateAsset] = useUpdateAssetMutation();
  const [deleteAsset] = useDeleteAssetMutation();
  const [moveAsset] = useMoveAssetMutation();

  const {
    isUploading,
    uploads,
    dismissUploads,
    isDragging,
    fileInputRef,
    handleRescanUsage,
    handleFileSelect,
    handleDragEvents,
    handleDrop,
    downloadAsset,
  } = useAssetOperations(currentPath);

  const allAvailableFolders = useMemo(
    () => getAllFolderPaths(assets),
    [assets],
  );

  // Deleting unused files offers Undo: the storage delete runs only
  // when the toast closes. A batch is one toast; its key lists its ids.
  const { pending: deleting, remove: removeBatch } = useUndoableDelete<{
    id: string;
    assets: StorageAsset[];
  }>(async (batch) => {
    try {
      await Promise.all(
        batch.assets.map((asset) => deleteAsset(asset).unwrap()),
      );
    } catch (err) {
      toast.error("Couldn't delete every asset", {
        description: getErrorMessage(err),
      });
    }
  });
  const hidden = useMemo(
    () => new Set([...deleting].flatMap((key) => key.split("|"))),
    [deleting],
  );

  const { currentFolderAssets, subFolders } = useMemo(
    () =>
      getAssetsForPath(
        hidden.size ? assets.filter((a) => !hidden.has(a.id)) : assets,
        currentPath,
      ),
    [assets, currentPath, hidden],
  );

  const selectedAssets = useMemo(
    () => currentFolderAssets.filter((a) => bulkSelectedIds.has(a.id)),
    [currentFolderAssets, bulkSelectedIds],
  );

  const clearSelection = () => setBulkSelectedIds(new Set());

  const navigateToFolder = (folderName: string) => {
    setCurrentPath((prev) => [...prev, folderName]);
    clearSelection();
  };
  const navigateUp = () => {
    setCurrentPath((prev) => prev.slice(0, -1));
    clearSelection();
  };
  const navigateToBreadcrumb = (index: number) => {
    setCurrentPath((prev) => prev.slice(0, index + 1));
    clearSelection();
  };
  const navigateRoot = () => {
    setCurrentPath([]);
    clearSelection();
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    if (!supabase) return;

    const pathPrefix =
      currentPath.length > 0 ? currentPath.join("/") + "/" : "";
    const safeName = sanitizeFolderName(newFolderName);
    if (!safeName) {
      toast.error("That folder name can't be used", {
        description: "Use letters, numbers, dots, dashes or underscores.",
      });
      return;
    }

    if (subFolders.includes(safeName)) {
      toast.error("That folder already exists here");
      return;
    }

    const fullPath = `${pathPrefix}${safeName}/${PLACEHOLDER_FILENAME}`;

    try {
      const dummyFile = new File([""], PLACEHOLDER_FILENAME, {
        type: "text/plain",
      });
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fullPath, dummyFile);
      if (uploadError) throw uploadError;

      await addAsset({
        file_name: PLACEHOLDER_FILENAME,
        file_path: fullPath,
        mime_type: "application/x-directory",
        size_kb: 0,
      }).unwrap();

      toast.success(`Folder "${safeName}" created`);
      setIsCreateFolderOpen(false);
      setNewFolderName("");
    } catch (err) {
      toast.error("Couldn't create the folder", {
        description: getErrorMessage(err),
      });
    }
  };

  /**
   * One move path, whichever gesture asked for it.
   *
   * The dialog and a drag onto a folder card must warn about the same thing:
   * a move rewrites `file_path`, and nothing updates the references in
   * published content that point at the old one. A second implementation for
   * the drag would be a second chance to forget that.
   */
  const moveAssetsTo = async (
    assets: StorageAsset[],
    destination: string,
  ): Promise<boolean> => {
    if (assets.length === 0) return false;

    // A move rewrites `file_path`, and every reference in published content
    // points at the old path. Nothing rewrites those references, so this is a
    // breaking change to live pages whenever the asset is in use.
    const usage = describeUsage(assets);
    if (usage) {
      const ok = await confirm({
        title: `Move ${pluralAssets(assets.length)}?`,
        description: `${usage} Moving changes their URLs, and the existing references are not updated — those pages will show a broken image until you point them at the new path.`,
        confirmText: "Move anyway",
      });
      if (!ok) return false;
    }

    try {
      await Promise.all(
        assets.map((asset) => {
          const newPath = targetPathForMove(asset, destination);
          if (newPath === asset.file_path) return Promise.resolve();
          return moveAsset({
            assetId: asset.id,
            oldPath: asset.file_path,
            newPath,
          }).unwrap();
        }),
      );
      toast.success(`Moved ${pluralAssets(assets.length)}`);
      await handleRescanUsage(true);
      return true;
    } catch (err) {
      toast.error("Couldn't move every asset", {
        description: getErrorMessage(err),
      });
      return false;
    }
  };

  const handleMoveAssets = async () => {
    const moved = await moveAssetsTo(selectedAssets, targetMoveFolder);
    if (!moved) return;
    clearSelection();
    setIsMoveDialogOpen(false);
    setIsBulkSelectMode(false);
  };

  /**
   * Assets dropped onto a folder card.
   *
   * The ids come off the drag rather than from the current selection, because
   * dragging an *unselected* asset should move that one and not quietly take a
   * selection you had forgotten about along with it.
   */
  const handleDropOnFolder = async (folder: string, assetIds: string[]) => {
    const ids = new Set(assetIds);
    const dragged = assets.filter((asset) => ids.has(asset.id));
    const destination = [...currentPath, folder].join("/");

    const moved = await moveAssetsTo(dragged, destination);
    if (moved) {
      clearSelection();
      setIsBulkSelectMode(false);
    }
  };

  /**
   * Unused files go at once, with Undo. Files that pages use still ask
   * first, and say which pages: deleting them breaks live pages, and that
   * consequence deserves a decision, not a toast that may be missed.
   */
  const handleDeleteAssets = async (assetsToDelete: StorageAsset[]) => {
    if (assetsToDelete.length === 0) return;
    const finish = () => {
      if (
        selectedAsset &&
        assetsToDelete.some((a) => a.id === selectedAsset.id)
      )
        setSelectedAsset(null);
      if (isBulkSelectMode) {
        setIsBulkSelectMode(false);
        clearSelection();
      }
    };

    const usage = describeUsage(assetsToDelete);
    if (!usage) {
      removeBatch(
        {
          id: assetsToDelete.map((a) => a.id).join("|"),
          assets: assetsToDelete,
        },
        `Deleted ${pluralAssets(assetsToDelete.length)}`,
      );
      finish();
      return;
    }

    const ok = await confirm({
      title: `Delete ${pluralAssets(assetsToDelete.length)}?`,
      description: `${usage} Deleting removes the file from storage, so those pages will show a broken image. This cannot be undone.`,
      variant: "destructive",
      confirmText: "Delete",
    });
    if (!ok) return;

    try {
      await Promise.all(
        assetsToDelete.map((asset) => deleteAsset(asset).unwrap()),
      );
      toast.success(`Deleted ${pluralAssets(assetsToDelete.length)}`);
      finish();
    } catch (err) {
      toast.error("Couldn't delete every asset", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleUpdateAltText = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAsset) return;
    const formData = new FormData(e.currentTarget);
    const alt_text = (formData.get("alt_text") as string) || "";

    try {
      const updated = await updateAsset({
        id: selectedAsset.id,
        alt_text,
      }).unwrap();
      toast.success("Alt text saved.");
      setSelectedAsset(updated);
    } catch (err) {
      toast.error("Couldn't save the alt text", {
        description: getErrorMessage(err),
      });
    }
  };

  const toggleBulkSelect = (id: string) => {
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const viewProps = {
    assets: currentFolderAssets,
    isBulkSelectMode,
    bulkSelectedIds,
    onToggleSelect: toggleBulkSelect,
    onSelect: setSelectedAsset,
    onDownload: downloadAsset,
    onDelete: (asset: StorageAsset) => handleDeleteAssets([asset]),
  };

  const isEmptyFolder =
    subFolders.length === 0 && currentFolderAssets.length === 0;

  return (
    <ManagerWrapper>
      <PageHeader
        title="Assets"
        description="Images and files your pages use."
        actions={
          /* Every control is available at every width. Creating a folder and
             rescanning used to be `hidden sm:flex`, so on a phone neither was
             reachable at all. */
          // One primary (G7): Upload. Creating a folder is occasional and a
          // usage rescan is maintenance, so both wait under the menu; every
          // control stays reachable at every width.
          <div className="flex items-center gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-describedby="assets-public-note"
            >
              {isUploading ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="mr-2 size-4" aria-hidden />
              )}
              Upload
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="More asset actions"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setIsCreateFolderOpen(true)}>
                  <FolderPlus className="mr-2 size-4" aria-hidden /> New folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isLoading}
                  onSelect={() => handleRescanUsage()}
                >
                  <RefreshCw className="mr-2 size-4" aria-hidden /> Rescan usage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/*
        The bucket is public. Every file here is readable by
        anyone who has its link, so say so where the upload happens rather than
        let a receipt or an ID scan end up world-readable by accident.
      */}
      <p
        id="assets-public-note"
        className="-mt-2 mb-4 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Globe className="size-3.5 shrink-0" aria-hidden />
        Public: anyone with a file&apos;s link can open it. Keep private
        documents out of Assets.
      </p>

      <input
        type="file"
        ref={fileInputRef}
        multiple
        onChange={handleFileSelect}
        aria-label="Upload assets"
        aria-describedby="assets-public-note"
        className="sr-only"
      />

      {/*
        A workspace, not a strip.
        
        The drop region wraps the toolbar and the grid, so with only a handful
        of assets it was a few hundred pixels tall and the upload target was a
        sliver of the page. A minimum height gives the folder a shape whether
        it holds three files or three hundred, and gives the drop overlay
        something to fill.
      */}
      <div
        className="relative min-h-[60vh]"
        onDragEnter={(e) => handleDragEvents(e, true)}
        onDragLeave={(e) => handleDragEvents(e, false)}
        onDragOver={(e) => handleDragEvents(e, true)}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-overlay flex flex-col items-center justify-center rounded-surface border border-dashed border-primary bg-primary/10 backdrop-blur-sm">
            <Upload className="mb-2 size-10 text-primary" aria-hidden />
            <p className="font-medium text-primary">
              Drop to upload into this folder
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Uploads are public to anyone with the link.
            </p>
          </div>
        )}

        {/*
          Per-file progress, above the grid rather than as a toast: a toast is
          gone by the time "which one failed?" is asked, and an upload that
          takes minutes needs somewhere to live while it does.
        */}
        <UploadQueue tasks={uploads} onDismiss={dismissUploads} />

        {/* Where you are, at the head of the toolbar (it was squeezed into
            the header's description). */}
        <div className="mb-3 min-w-0">
          <AssetBreadcrumbs
            currentPath={currentPath}
            onNavigateRoot={navigateRoot}
            onNavigateToBreadcrumb={navigateToBreadcrumb}
          />
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {currentPath.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateUp}
                aria-label="Go to parent folder"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
            )}
            <Button
              variant={isBulkSelectMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setIsBulkSelectMode(!isBulkSelectMode);
                clearSelection();
              }}
            >
              {isBulkSelectMode ? "Done selecting" : "Select"}
            </Button>

            {/* The selection actions live next to the selection, and say how
                many they act on. */}
            {isBulkSelectMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMoveDialogOpen(true)}
                  disabled={selectedAssets.length === 0}
                >
                  <Move className="mr-2 size-4" aria-hidden /> Move
                  {selectedAssets.length > 0 && ` (${selectedAssets.length})`}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteAssets(selectedAssets)}
                  disabled={selectedAssets.length === 0}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden /> Delete
                  {selectedAssets.length > 0 && ` (${selectedAssets.length})`}
                </Button>
                {selectedAssets.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <X className="mr-2 size-4" aria-hidden /> Clear
                  </Button>
                )}
              </>
            )}
          </div>

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value) setViewMode(value as "grid" | "list");
            }}
            size="sm"
          >
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="size-4" aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="size-4" aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {isLoading && assets.length === 0 ? (
          <LoadingState variant="section" label="Loading assets" />
        ) : isEmptyFolder ? (
          <EmptyState
            icon={ImageOff}
            variant="card"
            title={
              currentPath.length > 0 ? "This folder is empty" : "No assets yet"
            }
            description="Upload files by dropping them here, or create a folder to organise them first."
            action={{
              label: "New folder",
              onClick: () => setIsCreateFolderOpen(true),
              icon: FolderPlus,
            }}
          />
        ) : (
          <>
            <FolderGrid
              folders={subFolders}
              onOpen={navigateToFolder}
              onDropAssets={handleDropOnFolder}
            />

            {currentFolderAssets.length > 0 && (
              <div>
                {subFolders.length > 0 && (
                  <h3 className="t-micro mb-3">Files</h3>
                )}
                {viewMode === "grid" ? (
                  <AssetGrid {...viewProps} />
                ) : (
                  <AssetTable {...viewProps} />
                )}
              </div>
            )}
          </>
        )}
      </div>

      <CreateFolderDialog
        open={isCreateFolderOpen}
        onOpenChange={setIsCreateFolderOpen}
        currentPath={currentPath}
        folderName={newFolderName}
        onFolderNameChange={setNewFolderName}
        onSubmit={handleCreateFolder}
      />

      <MoveAssetsDialog
        open={isMoveDialogOpen}
        onOpenChange={setIsMoveDialogOpen}
        selectedCount={selectedAssets.length}
        availableFolders={allAvailableFolders}
        targetFolder={targetMoveFolder}
        onTargetFolderChange={setTargetMoveFolder}
        onSubmit={handleMoveAssets}
      />

      <AssetDetailsSheet
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onUpdateAltText={handleUpdateAltText}
        onDownload={downloadAsset}
        onDelete={(asset) => handleDeleteAssets([asset])}
      />
    </ManagerWrapper>
  );
}
