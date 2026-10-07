import React from "react";
import {
  FileArchive,
  FileAudio,
  FileCode,
  File as FileIcon,
  FileText,
  FileVideo,
} from "lucide-react";

export type StorageAsset = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_kb: number | null;
  alt_text: string | null;
  used_in: { type: string; id: string }[] | null;
  created_at: string;
};

export const BUCKET_NAME = process.env.NEXT_PUBLIC_BUCKET_NAME || "assets";
export const PLACEHOLDER_FILENAME = ".emptyFolderPlaceholder";

/**
 * Turn a typed folder name into one safe path segment.
 *
 * The previous rule was `replace(/[^a-zA-Z0-9._-]/g, "_")`, which allowlists
 * `.` — so `..` passed through completely unchanged and was interpolated
 * straight into the storage key as `parent/../.emptyFolderPlaceholder`. A name
 * of `.` or `..` is a traversal segment, not a folder, and a leading dot also
 * produces a hidden entry the browser cannot navigate back out of.
 *
 * Returns null when nothing usable remains, so callers can reject rather than
 * silently create a folder under a name the user did not choose.
 */
export function sanitizeFolderName(raw: string): string | null {
  const collapsed = raw.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  // Strip leading dots: kills "." and ".." outright, and prevents hidden dirs.
  const withoutLeadingDots = collapsed.replace(/^\.+/, "");
  if (!withoutLeadingDots || /^_+$/.test(withoutLeadingDots)) return null;
  return withoutLeadingDots;
}

/**
 * The name the file actually has in the bucket.
 *
 * `file_name` is the *original* name the browser reported at upload and is only
 * for display; the stored key is `<timestamp>_<sanitized name>`. Anything that
 * builds a storage path has to derive it from `file_path`, never from
 * `file_name` — see `targetPathForMove`.
 */
function assetBasename(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

/**
 * Where a move should put an asset.
 *
 * The move dialog used to build this from `file_name`, which quietly renamed
 * the object: `photos/1712_holiday_snap.png` moved to the root became
 * `holiday snap.png`. That drops the timestamp that keeps names unique and the
 * sanitisation that keeps them path-safe, so two assets uploaded under the same
 * original name collide on `file_path` — which is UNIQUE. The storage move runs
 * before the database update, so the collision fails *after* the object has
 * already moved, leaving the row pointing at a key that no longer exists.
 *
 * Keeping the stored basename makes a move a move rather than a rename.
 */
export function targetPathForMove(
  asset: { file_path: string },
  targetFolder: string,
): string {
  const name = assetBasename(asset.file_path);
  return targetFolder === "root" ? name : `${targetFolder}/${name}`;
}

/** Assets referenced by published content, per the last usage rescan. */
export function assetsInUse<T extends { used_in: unknown[] | null }>(
  assets: T[],
): T[] {
  return assets.filter((asset) => (asset.used_in?.length ?? 0) > 0);
}

export const getFileIcon = (mimeType: string | null, className?: string) => {
  if (!mimeType) return React.createElement(FileIcon, { className });
  if (mimeType.startsWith("image/")) return null;
  if (mimeType.startsWith("video/"))
    return React.createElement(FileVideo, { className });
  if (mimeType.startsWith("audio/"))
    return React.createElement(FileAudio, { className });
  if (mimeType.includes("pdf"))
    return React.createElement(FileText, { className });
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar")
  )
    return React.createElement(FileArchive, { className });
  if (
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("html")
  )
    return React.createElement(FileCode, { className });
  return React.createElement(FileIcon, { className });
};

export const getAllFolderPaths = (
  assets: Array<{ file_path: string }>,
): string[] => {
  const folders = new Set<string>();
  assets.forEach((asset) => {
    const parts = asset.file_path.split("/");
    if (parts.length > 1) {
      const folderPath = parts.slice(0, -1).join("/");
      folders.add(folderPath);
    }
  });
  return Array.from(folders).sort();
};

export const getAssetsForPath = <
  T extends { file_path: string; file_name: string },
>(
  assets: T[],
  currentPath: string[],
): { currentFolderAssets: T[]; subFolders: string[] } => {
  const pathPrefix = currentPath.length > 0 ? currentPath.join("/") + "/" : "";

  const folders = new Set<string>();
  const files: T[] = [];

  assets.forEach((asset) => {
    if (!asset.file_path.startsWith(pathPrefix)) return;

    const relativePath = asset.file_path.slice(pathPrefix.length);
    const parts = relativePath.split("/");

    if (parts.length > 1) {
      folders.add(parts[0]);
    } else {
      if (asset.file_name !== PLACEHOLDER_FILENAME) {
        files.push(asset);
      }
    }
  });

  return {
    subFolders: Array.from(folders).sort(),
    currentFolderAssets: files,
  };
};
