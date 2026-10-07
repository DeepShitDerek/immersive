"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { categoryOptions } from "../domain/categories";
import type { Bucket } from "../domain/model";
import type { AccountRecord } from "../data/rows";
import { useMoney } from "./money-context";
import { ACCOUNT_GROUPS } from "./labels";

/** Radix Select reserves "", so "nothing chosen" travels as this. */
const NONE = "__none__";

/**
 * A searchable category picker. Filtering is done here on the label —
 * cmdk's own filter would match against the item value, which is an id.
 */
export function CategoryPicker({
  value,
  onChange,
  id,
  buckets,
  allowNone = true,
  noneLabel = "Uncategorised",
  "aria-label": ariaLabel,
}: {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  id?: string;
  /**
   * The name when no <label for={id}> names it. A combobox does not take its
   * name from the text inside, so without one of the two it has none.
   */
  "aria-label"?: string;
  /** Only categories in these buckets (income for income, and so on). */
  buckets?: readonly Bucket[];
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const { categories, categoryById } = useMoney();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const options = useMemo(
    () =>
      categoryOptions(categories).filter(
        (option) => !buckets || buckets.includes(option.category.bucket),
      ),
    [categories, buckets],
  );
  const term = search.trim().toLowerCase();
  const shown = term
    ? options.filter((o) => o.label.toLowerCase().includes(term))
    : options;
  const selected = value ? categoryById.get(value) : null;
  const selectedLabel = selected
    ? (options.find((o) => o.category.id === value)?.label ?? selected.name)
    : allowNone
      ? noneLabel
      : "Choose a category";

  const choose = (next: string | null) => {
    onChange(next);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="w-full justify-between font-normal"
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {selectedLabel}
          </span>
          <ChevronsUpDown
            aria-hidden
            className="ml-2 size-4 shrink-0 opacity-50"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-64 p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search categories…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No category matches.</CommandEmpty>
            <CommandGroup>
              {allowNone && !term && (
                <CommandItem value={NONE} onSelect={() => choose(null)}>
                  <Check
                    aria-hidden
                    className={cn(
                      "mr-2 size-4",
                      value === null ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="text-muted-foreground">{noneLabel}</span>
                </CommandItem>
              )}
              {shown.map((option) => (
                <CommandItem
                  key={option.category.id}
                  value={option.category.id}
                  onSelect={() => choose(option.category.id)}
                >
                  <Check
                    aria-hidden
                    className={cn(
                      "mr-2 size-4",
                      value === option.category.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className={cn(option.depth === 1 && !term && "pl-4")}>
                    {term || option.depth === 0
                      ? option.label
                      : option.category.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** An account select, grouped the way the accounts screen groups them. */
export function AccountSelect({
  value,
  onChange,
  id,
  accounts,
  placeholder = "Choose an account",
  allowNone = false,
  noneLabel = "Any account",
}: {
  value: string | null;
  onChange: (accountId: string | null) => void;
  id?: string;
  /** Defaults to the open accounts. */
  accounts?: readonly AccountRecord[];
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const { openAccounts } = useMoney();
  const list = accounts ?? openAccounts;
  return (
    <Select
      value={value ?? (allowNone ? NONE : undefined)}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {ACCOUNT_GROUPS.map((group) => {
          const members = list.filter((a) => group.kinds.includes(a.kind));
          if (members.length === 0) return null;
          return (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {members.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}{" "}
                  <span className="text-muted-foreground">
                    · {account.currency}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
