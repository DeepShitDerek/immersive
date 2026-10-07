"use client";

import { useState, type FormEvent } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { FormSheet } from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import { categoryOptions, STARTER_CATEGORIES } from "../domain/categories";
import type { Bucket, Category } from "../domain/model";
import {
  useSaveCategoryMutation,
  useSeedCategoriesMutation,
  useSetCategoryArchivedMutation,
} from "../data/money-api";
import { BUCKET_LABEL } from "./labels";
import { useMoney } from "./money-context";

const TOP = "__top__";
const BUCKETS: Bucket[] = ["income", "need", "want", "save"];

export function CategoriesPanel() {
  const { categories } = useMoney();
  const [seed, seeding] = useSeedCategoriesMutation();
  const [archive] = useSetCategoryArchivedMutation();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const options = categoryOptions(categories, {
    includeArchived: showArchived,
  });

  const seedStarter = async () => {
    try {
      await seed([...STARTER_CATEGORIES]).unwrap();
      toast.success("Starter categories added");
    } catch (error) {
      toast.error("Couldn't add them", { description: getErrorMessage(error) });
    }
  };

  return (
    <section aria-labelledby="categories-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="categories-heading"
            className="font-heading text-lg font-semibold"
          >
            Categories
          </h2>
          <p className="text-sm text-muted-foreground">
            Two levels (Housing › Rent). A subcategory shares its parent&apos;s
            bucket, so the 50/30/20 split never counts anything twice.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={seedStarter}
            disabled={seeding.isLoading}
          >
            <Sparkles className="mr-2 size-4" />{" "}
            {categories.length ? "Add missing starters" : "Use the starter set"}
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-2 size-4" /> Category
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="cats-archived"
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
        <Label htmlFor="cats-archived" className="font-normal">
          Show archived
        </Label>
      </div>

      {options.length === 0 ? (
        <p className="rounded-surface border border-dashed p-6 text-center text-sm text-muted-foreground">
          No categories yet. The starter set is made for living in Canada with
          family in India — rent, transit, sending money home, immigration fees
          — and you can change any of it.
        </p>
      ) : (
        <ul className="divide-y rounded-surface border bg-card text-sm">
          {options.map(({ category, depth }) => (
            <li key={category.id} className="flex items-center gap-3 px-4 py-2">
              <span
                className={
                  depth
                    ? "flex-1 pl-6 text-muted-foreground"
                    : "flex-1 font-medium"
                }
              >
                {category.name}
                {category.archivedAt && (
                  <span className="ml-2 text-xs">(archived)</span>
                )}
              </span>
              {depth === 0 && (
                <span className="text-xs text-muted-foreground">
                  {BUCKET_LABEL[category.bucket]}
                  {category.isEssential ? " · essential" : ""}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${category.name}`}
                onClick={() => setEditing(category)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  category.archivedAt
                    ? `Restore ${category.name}`
                    : `Archive ${category.name}`
                }
                onClick={() =>
                  archive({ id: category.id, archived: !category.archivedAt })
                }
              >
                {category.archivedAt ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CategorySheet category={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function CategorySheet({
  category,
  onClose,
}: {
  category: Category | "new" | null;
  onClose: () => void;
}) {
  const { categories } = useMoney();
  const [save, saving] = useSaveCategoryMutation();
  const existing = category && category !== "new" ? category : null;
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>("want");
  const [essential, setEssential] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [lastOpened, setLastOpened] = useState<Category | "new" | null>(null);

  if (category !== lastOpened) {
    setLastOpened(category);
    setName(existing?.name ?? "");
    setParentId(existing?.parentId ?? null);
    setBucket(existing?.bucket ?? "want");
    setEssential(existing?.isEssential ?? false);
    setProblem(null);
  }

  const hasChildren = existing
    ? categories.some((c) => c.parentId === existing.id)
    : false;
  const parents = categories.filter(
    (c) => !c.parentId && !c.archivedAt && c.id !== existing?.id,
  );
  const parent = parentId ? categories.find((c) => c.id === parentId) : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || name.trim().length > 80) {
      setProblem("Give it a name (up to 80 characters).");
      return;
    }
    try {
      await save({
        id: existing?.id,
        name,
        parentId,
        bucket: parent ? parent.bucket : bucket,
        isEssential: essential,
        icon: existing?.icon ?? null,
        color: existing?.color ?? null,
        sortOrder: existing?.sortOrder ?? categories.length,
      }).unwrap();
      toast.success(existing ? "Category updated" : "Category added");
      onClose();
    } catch (error) {
      const message = getErrorMessage(error);
      setProblem(
        /money_category_name_key/.test(message)
          ? "There is already a category with that name here."
          : message,
      );
    }
  };

  return (
    <FormSheet
      open={!!category}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? `Edit ${existing.name}` : "New category"}
      footer={
        <Button
          type="submit"
          form="money-category"
          className="w-full"
          disabled={saving.isLoading}
        >
          Save
        </Button>
      }
    >
      <form
        id="money-category"
        onSubmit={submit}
        className="space-y-5"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="cat-name">Name</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat-parent">Inside</Label>
          <Select
            value={parentId ?? TOP}
            onValueChange={(v) => setParentId(v === TOP ? null : v)}
            disabled={hasChildren}
          >
            <SelectTrigger id="cat-parent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOP}>
                Nothing — a top-level category
              </SelectItem>
              {parents.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasChildren && (
            <p className="text-xs text-muted-foreground">
              It has subcategories, so it stays top-level.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat-bucket">Bucket</Label>
          <Select
            value={parent ? parent.bucket : bucket}
            onValueChange={(v) => setBucket(v as Bucket)}
            disabled={!!parent}
          >
            <SelectTrigger id="cat-bucket">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUCKETS.map((b) => (
                <SelectItem key={b} value={b}>
                  {BUCKET_LABEL[b]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {parent && (
            <p className="text-xs text-muted-foreground">
              Taken from {parent.name}.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between rounded-control border px-3 py-2.5">
          <Label htmlFor="cat-essential" className="font-normal">
            Essential — still paid if income stopped
          </Label>
          <Switch
            id="cat-essential"
            checked={essential}
            onCheckedChange={setEssential}
          />
        </div>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </form>
    </FormSheet>
  );
}
