"use client";

import { Download, FileAudio, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStorageUrl } from "@/lib/utils";
import { getFileIcon, type StorageAsset } from "./asset-utils";

export interface AssetPreviewProps {
  asset: StorageAsset;
  onDownload: (asset: StorageAsset) => void;
}

export function AssetPreview({ asset, onDownload }: AssetPreviewProps) {
  const url = getStorageUrl(asset.file_path);
  const mime = asset.mime_type || "";

  if (mime.startsWith("image/")) {
    return (
      <img
        src={url}
        alt={asset.alt_text || asset.file_name}
        className="max-h-[300px] w-auto rounded-control border object-contain"
      />
    );
  }

  if (mime.startsWith("video/")) {
    return (
      <video
        src={url}
        controls
        className="max-h-[300px] w-full rounded-control bg-black"
      />
    );
  }

  if (mime.startsWith("audio/")) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-md bg-secondary p-4">
        <FileAudio className="size-16 text-primary" />
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  if (mime.includes("pdf")) {
    return (
      <div className="flex h-[300px] w-full flex-col items-center justify-center gap-4 rounded-md border bg-secondary/20">
        <FileText className="size-16 text-muted-foreground" />
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open PDF
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      {getFileIcon(mime, "size-20 mb-4 opacity-50")}
      <p className="text-sm">Preview not available for this file type.</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => onDownload(asset)}
      >
        <Download className="mr-2 size-4" /> Download File
      </Button>
    </div>
  );
}
