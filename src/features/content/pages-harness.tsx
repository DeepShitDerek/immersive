"use client";

import { useState } from "react";
import type { PortfolioItem, PortfolioSection } from "@/types";
import { SectionDetail } from "./section-detail";
import { SectionEditorSheet } from "./section-editor-sheet";

/** Placeholder rows: the harness checks layout, not content. */
const item = (id: string, order: number): PortfolioItem =>
  ({
    id,
    section_id: "harness",
    title: `Sample item ${order}`,
    subtitle: "Subtitle",
    display_order: order,
    tags: ["one", "two"],
  }) as unknown as PortfolioItem;

const SAMPLE = {
  id: "harness",
  title: "Sample section",
  type: "list_items",
  layout_style: "cards-with-image",
  page_path: "/",
  is_visible: true,
  display_order: 0,
  portfolio_items: [item("a", 1), item("b", 2)],
} as unknown as PortfolioSection;

/** A section in the editor pane, and its settings sheet one click away. */
export function PagesHarness() {
  const [section, setSection] = useState(SAMPLE);
  const [settings, setSettings] = useState(false);
  return (
    <main className="mx-auto max-w-4xl p-6">
      <SectionDetail
        section={section}
        onEditSection={() => setSettings(true)}
        onDeleteSection={() => {}}
        onToggleVisible={(s) =>
          setSection({ ...s, is_visible: s.is_visible === false })
        }
        onSaveContent={() => {}}
        onNewItem={() => {}}
        onEditItem={() => {}}
        onDeleteItem={() => {}}
        onMoveItem={() => {}}
      />
      {settings && (
        <SectionEditorSheet
          section={section}
          availablePaths={[{ label: "/ (home)", value: "/" }]}
          onSave={async () => setSettings(false)}
          onClose={() => setSettings(false)}
        />
      )}
    </main>
  );
}
