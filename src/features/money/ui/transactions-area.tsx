"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Download,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { downloadText } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterChip, RemovableChip } from "@/components/ui/filter-chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { categoryLabel } from "../domain/categories";
import {
  register,
  type Transaction,
  TRANSACTION_KINDS,
} from "../domain/ledger";
import { ledgerCsv } from "../domain/ledger-csv";
import {
  childrenIndex,
  filterTransactions,
  isUncategorised,
  type TransactionFilter,
} from "../domain/ledger-query";
import { Amount } from "./amount";
import { shortDate, TRANSACTION_KIND_LABEL } from "./labels";
import { useMoney } from "./money-context";
import { AccountSelect, CategoryPicker } from "./pickers";
import { TransactionSheet } from "./transaction-sheet";

const PAGE = 200;
const ANY = "__any__";

/**
 * The register: every transaction, newest first, filtered. With a
 * single account chosen it shows that account's running balance, which is
 * how a statement reads and how a mistake is found.
 */
export function TransactionsArea({
  accountId,
  onAccountChange,
}: {
  accountId: string | null;
  onAccountChange: (accountId: string | null) => void;
}) {
  const {
    transactions,
    accountById,
    categories,
    categoryById,
    openAccounts,
    today,
  } = useMoney();
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [uncategorised, setUncategorised] = useState(false);
  const [kind, setKind] = useState<TransactionFilter["kind"]>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const children = useMemo(() => childrenIndex(categories), [categories]);
  const filtered = useMemo(
    () =>
      filterTransactions(transactions, {
        accountId,
        categoryId: uncategorised ? "none" : categoryId,
        childrenOf: children,
        kind,
        from: from || null,
        to: to || null,
        text,
      }),
    [
      transactions,
      accountId,
      categoryId,
      uncategorised,
      children,
      kind,
      from,
      to,
      text,
    ],
  );

  // Running balance only makes sense unfiltered by anything but the account.
  const running = useMemo(() => {
    if (
      !accountId ||
      categoryId ||
      uncategorised ||
      kind ||
      from ||
      to ||
      text.trim()
    )
      return null;
    const account = accountById.get(accountId);
    if (!account) return null;
    return new Map(
      register(account, transactions).map((line) => [
        line.transaction.id,
        line.balanceMinor,
      ]),
    );
  }, [
    accountId,
    accountById,
    transactions,
    categoryId,
    uncategorised,
    kind,
    from,
    to,
    text,
  ]);

  const filtering = !!(
    accountId ||
    categoryId ||
    uncategorised ||
    kind ||
    from ||
    to ||
    text.trim()
  );
  const uncategorisedCount = useMemo(
    () => transactions.filter(isUncategorised).length,
    [transactions],
  );
  /** What is set, as chips that each clear one filter. Search shows in its own field. */
  const chips = [
    accountId && {
      key: "account",
      label: accountById.get(accountId)?.name ?? "Account",
      clear: () => onAccountChange(null),
    },
    categoryId && {
      key: "category",
      label: categoryLabel(categoryId, categoryById),
      clear: () => setCategoryId(null),
    },
    uncategorised && {
      key: "uncategorised",
      label: "Uncategorised",
      clear: () => setUncategorised(false),
    },
    kind && {
      key: "kind",
      label: TRANSACTION_KIND_LABEL[kind],
      clear: () => setKind(null),
    },
    (from || to) && {
      key: "dates",
      label:
        from && to ? `${from} – ${to}` : from ? `From ${from}` : `Until ${to}`,
      clear: () => {
        setFrom("");
        setTo("");
      },
    },
  ].filter((chip): chip is { key: string; label: string; clear: () => void } =>
    Boolean(chip),
  );
  const activeCount = chips.length;
  const clear = () => {
    onAccountChange(null);
    setCategoryId(null);
    setUncategorised(false);
    setKind(null);
    setFrom("");
    setTo("");
    setText("");
  };

  if (openAccounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add an account first — every transaction belongs to one.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/*
        One row: search, then Filters, then a menu.
        The five filter fields stacked about 470px deep on a phone before the
        first transaction; they now open from one button, and what is set
        shows below as chips you can remove one by one.
      */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Label htmlFor="txn-search" className="sr-only">
            Search
          </Label>
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="txn-search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search description, payee, notes…"
            className="pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="shrink-0 gap-2">
              <SlidersHorizontal aria-hidden className="size-4" />
              Filters
              {activeCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[min(26rem,calc(100vw-2rem))] space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="filter-account" className="text-xs">
                  Account
                </Label>
                <AccountSelect
                  id="filter-account"
                  value={accountId}
                  onChange={onAccountChange}
                  allowNone
                  noneLabel="All accounts"
                  accounts={[...accountById.values()]}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="filter-category" className="text-xs">
                  Category
                </Label>
                <CategoryPicker
                  id="filter-category"
                  value={uncategorised ? null : categoryId}
                  onChange={(id) => {
                    setCategoryId(id);
                    setUncategorised(false);
                  }}
                  noneLabel="Any category"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="filter-kind" className="text-xs">
                  Kind
                </Label>
                <Select
                  value={kind ?? ANY}
                  onValueChange={(v) =>
                    setKind(v === ANY ? null : (v as TransactionFilter["kind"]))
                  }
                >
                  <SelectTrigger id="filter-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any kind</SelectItem>
                    {TRANSACTION_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {TRANSACTION_KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-from" className="text-xs">
                  From
                </Label>
                <Input
                  id="filter-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-to" className="text-xs">
                  To
                </Label>
                <Input
                  id="filter-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={uncategorised}
                onCheckedChange={(v) => {
                  setUncategorised(v === true);
                  if (v === true) setCategoryId(null);
                }}
              />
              Uncategorised only
            </label>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="More ledger actions"
              className="shrink-0"
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* What is filtered is what is exported — set the dates for a tax year. */}
            <DropdownMenuItem
              disabled={filtered.length === 0}
              onSelect={() =>
                downloadText(
                  `ledger-${from || "start"}-to-${to || "today"}.csv`,
                  ledgerCsv(filtered, accountById, categoryById),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download aria-hidden className="mr-2 size-4" />
              Export these as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="mr-1 tabular-nums text-muted-foreground">
          {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
        </span>
        {chips.map((chip) => (
          <RemovableChip
            key={chip.key}
            label={chip.label}
            onRemove={chip.clear}
          />
        ))}
        {!uncategorised && uncategorisedCount > 0 && (
          <FilterChip
            active={false}
            count={uncategorisedCount}
            onClick={() => {
              setUncategorised(true);
              setCategoryId(null);
            }}
          >
            Uncategorised
          </FilterChip>
        )}
        {filtering && (
          <button
            type="button"
            className="rounded-control text-primary underline-offset-2 hover:underline focus-ring"
            onClick={clear}
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
          {transactions.length === 0
            ? "No transactions yet. Add one, or import a statement from your bank."
            : "Nothing matches these filters."}
        </p>
      ) : (
        <ul className="divide-y rounded-surface border bg-card">
          {filtered.slice(0, limit).map((txn) => (
            <TransactionRow
              key={txn.id}
              txn={txn}
              focusAccountId={accountId}
              runningMinor={running?.get(txn.id) ?? null}
              onOpen={() => setEditing(txn)}
              accountName={(id) =>
                accountById.get(id)?.name ?? "Unknown account"
              }
              currencyOf={(id) => accountById.get(id)?.currency ?? "CAD"}
              categoryText={(id) => categoryLabel(id, categoryById)}
              today={today}
            />
          ))}
        </ul>
      )}
      {filtered.length > limit && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setLimit((l) => l + PAGE)}
        >
          Show {Math.min(PAGE, filtered.length - limit)} more
        </Button>
      )}

      <TransactionSheet
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        transaction={editing}
        defaultAccountId={accountId ?? undefined}
      />
    </div>
  );
}

function TransactionRow({
  txn,
  focusAccountId,
  runningMinor,
  onOpen,
  accountName,
  currencyOf,
  categoryText,
  today,
}: {
  txn: Transaction;
  focusAccountId: string | null;
  runningMinor: number | null;
  onOpen: () => void;
  accountName: (id: string) => string;
  currencyOf: (id: string) => string;
  categoryText: (id: string | null) => string;
  today: string;
}) {
  const legs = txn.postings.filter((p) => p.categoryId == null);
  const out = legs.find((p) => p.amountMinor < 0);
  const inn = legs.find((p) => p.amountMinor > 0);
  const primary = txn.kind === "transfer" ? out : txn.postings[0];
  const accountForAmount = focusAccountId ?? primary?.accountId ?? "";
  const net = txn.postings
    .filter((p) => p.accountId === accountForAmount)
    .reduce((total, p) => total + p.amountMinor, 0);
  const categories = [
    ...new Set(
      txn.postings
        .filter((p) => p.categoryId || txn.kind !== "transfer")
        .map((p) => categoryText(p.categoryId)),
    ),
  ];

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none"
      >
        {/* "Feb 3", with the year only outside this year. The ISO column took
            90px and cut every description to a dozen letters; on a phone the
            date moves into the second line instead. */}
        <time
          dateTime={txn.date}
          className="hidden w-16 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground sm:block"
        >
          {shortDate(txn.date, today)}
        </time>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {txn.payee && txn.payee !== txn.description
              ? `${txn.payee} · `
              : ""}
            {txn.description}
            {txn.status === "pending" && (
              <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-normal text-warning">
                Pending
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            <span className="sm:hidden">{shortDate(txn.date, today)} · </span>
            {txn.kind === "transfer" && out && inn ? (
              <>
                {accountName(out.accountId)}{" "}
                <ArrowRight aria-label="to" className="inline size-3" />{" "}
                {accountName(inn.accountId)}
                {txn.provider ? ` · ${txn.provider}` : ""}
              </>
            ) : (
              <>
                {accountName(primary?.accountId ?? "")} ·{" "}
                <span
                  className={cn(
                    categories.includes("Uncategorised") && "text-warning",
                  )}
                >
                  {categories.join(", ")}
                </span>
              </>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <Amount
            minor={net}
            currency={currencyOf(accountForAmount)}
            tone="flow"
            signed
            className="font-semibold"
          />
          {txn.kind === "transfer" &&
            inn &&
            out &&
            currencyOf(inn.accountId) !== currencyOf(out.accountId) &&
            !focusAccountId && (
              <span className="block text-xs text-muted-foreground">
                →{" "}
                <Amount
                  minor={inn.amountMinor}
                  currency={currencyOf(inn.accountId)}
                />
              </span>
            )}
          {runningMinor !== null && (
            <span className="block text-xs text-muted-foreground">
              <Amount
                minor={runningMinor}
                currency={currencyOf(accountForAmount)}
              />
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
