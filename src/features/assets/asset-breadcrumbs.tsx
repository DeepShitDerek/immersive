"use client";

import React from "react";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AssetBreadcrumbsProps {
  currentPath: string[];
  onNavigateRoot: () => void;
  onNavigateToBreadcrumb: (index: number) => void;
}

export function AssetBreadcrumbs({
  currentPath,
  onNavigateRoot,
  onNavigateToBreadcrumb,
}: AssetBreadcrumbsProps) {
  return (
    <div className="no-scrollbar mt-1 flex items-center gap-2 overflow-x-auto text-sm text-muted-foreground">
      <button
        onClick={onNavigateRoot}
        className={cn(
          "flex items-center transition-colors hover:text-primary",
          currentPath.length === 0 && "font-semibold text-foreground",
        )}
      >
        <Home className="mr-1 size-3.5" /> Root
      </button>
      {currentPath.map((folder, i) => (
        <React.Fragment key={folder + i}>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
          <button
            onClick={() => onNavigateToBreadcrumb(i)}
            className={cn(
              "whitespace-nowrap transition-colors hover:text-primary",
              i === currentPath.length - 1 && "font-semibold text-foreground",
            )}
          >
            {folder}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
