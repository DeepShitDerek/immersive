"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string[];
  folderName: string;
  onFolderNameChange: (name: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  currentPath,
  folderName,
  onFolderNameChange,
  onSubmit,
}: CreateFolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Create a subfolder in{" "}
            <strong>
              {currentPath.length ? currentPath.join("/") : "Root"}
            </strong>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => onFolderNameChange(e.target.value)}
              placeholder="e.g. project-screenshots"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface MoveAssetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  availableFolders: string[];
  targetFolder: string;
  onTargetFolderChange: (folder: string) => void;
  onSubmit: () => void;
}

export function MoveAssetsDialog({
  open,
  onOpenChange,
  selectedCount,
  availableFolders,
  targetFolder,
  onTargetFolderChange,
  onSubmit,
}: MoveAssetsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move Items</DialogTitle>
          <DialogDescription>
            Select destination folder for {selectedCount} item(s).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Destination Folder</Label>
            <Select onValueChange={onTargetFolderChange} value={targetFolder}>
              <SelectTrigger>
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="root">/ (Root)</SelectItem>
                {availableFolders.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Move Here</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
