"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import {
  SETTINGS_SECTIONS,
  groupMatches,
  type SettingsGroup,
} from "./settings-groups";

export interface SettingsNavProps {
  activeId: string;
  onSelect: (id: string) => void;
  /** Group ids with unsaved edits. */
  dirtyIds: ReadonlySet<string>;
  /** Group ids whose last save attempt failed validation. */
  invalidIds: ReadonlySet<string>;
  search: string;
  onSearchChange: (value: string) => void;
  className?: string;
}

export function SettingsNav({
  activeId,
  onSelect,
  dirtyIds,
  invalidIds,
  search,
  onSearchChange,
  className,
}: SettingsNavProps) {
  const sections = SETTINGS_SECTIONS.map((section) => ({
    ...section,
    groups: section.groups.filter((group) => groupMatches(group, search)),
  })).filter((section) => section.groups.length > 0);

  return (
    <nav
      aria-label="Settings groups"
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search settings"
          aria-label="Search settings"
          className="h-9 pl-9"
        />
      </div>

      {sections.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">
          Nothing matches “{search.trim()}”.
        </p>
      )}

      {sections.map((section) => (
        <div key={section.id} className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.groups.map((group) => (
              <li key={group.id}>
                <NavItem
                  group={group}
                  active={group.id === activeId}
                  dirty={dirtyIds.has(group.id)}
                  invalid={invalidIds.has(group.id)}
                  onSelect={() => onSelect(group.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavItem({
  group,
  active,
  dirty,
  invalid,
  onSelect,
}: {
  group: SettingsGroup;
  active: boolean;
  dirty: boolean;
  invalid: boolean;
  onSelect: () => void;
}) {
  const Icon = group.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm transition-colors focus-ring",
        active
          ? "bg-secondary font-medium text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{group.label}</span>

      {/*
        One dot, three meanings, and the text alternative carries the meaning
        rather than the colour: a red dot alone tells a colour-blind reader
        nothing that an unsaved dot does not.
      */}
      {(dirty || invalid) && (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            invalid ? "bg-destructive" : "bg-warning",
          )}
        >
          <span className="sr-only">
            {invalid ? "has errors" : "unsaved changes"}
          </span>
        </span>
      )}
    </button>
  );
}

/**
 * Below `lg`, the same groups as a select: the
 * rail lived in a sheet behind an "All settings" button, one more step
 * than choosing from a list. Unsaved and failing groups say so in words.
 */
export function SettingsGroupSwitcher({
  activeId,
  onSelect,
  dirtyIds,
  invalidIds,
  className,
}: Omit<SettingsNavProps, "search" | "onSearchChange">) {
  const note = (id: string) =>
    invalidIds.has(id) ? " · has errors" : dirtyIds.has(id) ? " · unsaved" : "";
  return (
    <Select value={activeId} onValueChange={onSelect}>
      <SelectTrigger
        aria-label="Settings group"
        className={cn("h-10", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SETTINGS_SECTIONS.map((section) => (
          <SelectGroup key={section.id}>
            <SelectLabel>{section.label}</SelectLabel>
            {section.groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.label}
                {note(group.id)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
