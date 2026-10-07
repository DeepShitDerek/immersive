import type { PortfolioItem, PortfolioSection } from "@/types";

export type SheetState =
  | { type: "new-section" }
  | { type: "edit-section"; section: PortfolioSection }
  | { type: "new-item"; sectionId: string }
  | { type: "edit-item"; item: PortfolioItem }
  | null;

export interface PathOption {
  label: string;
  value: string;
}
