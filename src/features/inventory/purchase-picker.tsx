"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, Link2, X } from "lucide-react";
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
  useGetAccountsQuery,
  useGetTransactionsQuery,
} from "@/features/money/data/money-api";
import { formatValue } from "./item-value";
import { type PurchaseOption, purchaseOptions } from "./purchase-link";

/**
 * Pick the ledger expense that bought an item. Only expenses are
 * offered, newest first. The ledger is read only when the picker is opened,
 * so an inventory form never pays for Money's data unasked.
 */
export function PurchasePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string | null;
  /** The chosen purchase, or null when the link is removed. */
  onChange: (option: PurchaseOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wanted = open || value !== null;
  const { data: transactions = [], isLoading } = useGetTransactionsQuery(
    undefined,
    { skip: !wanted },
  );
  const { data: accounts = [] } = useGetAccountsQuery(undefined, {
    skip: !wanted,
  });

  const options = useMemo(
    () =>
      purchaseOptions(transactions, new Map(accounts.map((a) => [a.id, a]))),
    [transactions, accounts],
  );
  const selected = options.find((o) => o.id === value) ?? null;
  const label = (o: PurchaseOption) =>
    `${o.date} · ${o.description} · ${formatValue(o.amount, o.currency)}`;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-w-0 flex-1 justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Link2
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate">
                {selected
                  ? label(selected)
                  : value
                    ? "Linked purchase"
                    : "Not linked"}
              </span>
            </span>
            <ChevronsUpDown
              className="ml-2 size-4 shrink-0 opacity-50"
              aria-hidden
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-72 p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search expenses…" />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading the ledger…" : "No expenses found."}
              </CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.date} ${o.description} ${o.id}`}
                    onSelect={() => {
                      onChange(o);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {o.description}
                    </span>
                    <span className="ml-2 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {o.date} · {formatValue(o.amount, o.currency)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove the purchase link"
          onClick={() => onChange(null)}
        >
          <X className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
