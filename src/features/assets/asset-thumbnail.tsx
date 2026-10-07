"use client";

import { getStorageUrl } from "@/lib/utils";
import { getFileIcon, type StorageAsset } from "./asset-utils";

export interface AssetThumbnailProps {
  asset: StorageAsset;
  /** Inside a control whose own text names the file: no alt, or it is read twice. */
  decorative?: boolean;
}

export function AssetThumbnail({
  asset,
  decorative = false,
}: AssetThumbnailProps) {
  const isImage = asset.mime_type?.startsWith("image/");

  if (isImage) {
    return (
      <img
        src={getStorageUrl(asset.file_path)}
        alt={decorative ? "" : asset.alt_text || asset.file_name}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  const Icon = getFileIcon(asset.mime_type, "size-8 text-muted-foreground");

  return (
    // A span, so it is valid inside a button.
    <span className="flex h-full w-full flex-col items-center justify-center bg-secondary/30 p-2 text-center transition-colors group-hover:bg-secondary/50">
      {Icon}
    </span>
  );
}
