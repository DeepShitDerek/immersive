"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/utils";
import { categoryLabel } from "../domain/categories";
import { parseCsv } from "../domain/csv";
import { priceInBase } from "../domain/fx";
import { everydayAccount, validateTransaction } from "../domain/ledger";
import { money } from "../domain/money";
import {
  type ColumnMapping,
  type DateOrder,
  detectDateOrder,
  guessMapping,
  importedPosting,
  readStatement,
} from "../domain/statement-import";
import { useImportTransactionsMutation } from "../data/money-api";
import type { TransactionDraft } from "../data/rows";
import { Amount } from "./amount";
import { useMoney } from "./money-context";
import { AccountSelect } from "./pickers";

const NONE = "__none__";
const MAX_BYTES = 5_000_000;
const BATCH = 2000;

/**
 * Bring in a bank's CSV export: choose the account, check how the
 * columns were read, see exactly what will be written — including what is
 * already in the ledger — and write it all at once.
 */
export function ImportArea() {
  const {
    openAccounts,
    accountById,
    rules,
    transactions,
    settings,
    rateTable,
    categoryById,
  } = useMoney();
  const [accountId, setAccountId] = useState<string | null>(
    everydayAccount(openAccounts, settings.baseCurrency)?.id ?? null,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [runImport, importing] = useImportTransactionsMutation();
  const account = accountId ? accountById.get(accountId) : undefined;

  const existing = useMemo(
    () => new Set(transactions.map((t) => t.importHash).filter(Boolean)),
    [transactions],
  );

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !account) return;
    if (file.size > MAX_BYTES) {
      toast.error("That file is over 5 MB — export a shorter date range.");
      return;
    }
    const parsed = parseCsv(await file.text());
    const guess = guessMapping(parsed, account.country, {
      currency: account.currency,
      card: account.kind === "credit_card" || account.kind === "line_of_credit",
    });
    if (!guess) {
      toast.error("Couldn't find a date and an amount column in that file.");
      return;
    }
    setFileName(file.name);
    setRows(parsed);
    setMapping(guess);
  };

  const result = useMemo(() => {
    if (!rows || !mapping || !account) return null;
    const statement = readStatement(rows, mapping, {
      accountId: account.id,
      currency: account.currency,
      rules,
    });
    const drafts: {
      draft: TransactionDraft;
      duplicate: boolean;
      problems: string[];
    }[] = statement.rows.map((row) => {
      const price = priceInBase(
        money(row.amountMinor, account.currency),
        settings.baseCurrency,
        row.date,
        rateTable,
      );
      const draft: TransactionDraft = {
        date: row.date,
        kind: row.kind,
        description: row.description,
        payee: row.payee,
        rawDescription: row.description,
        importHash: row.importHash,
        postings: [importedPosting(row, account.id, price)],
      };
      return {
        draft,
        duplicate: existing.has(row.importHash),
        problems: validateTransaction(
          { ...draft, marketRate: null },
          accountById,
        ),
      };
    });
    return { statement, drafts };
  }, [
    rows,
    mapping,
    account,
    rules,
    settings.baseCurrency,
    rateTable,
    existing,
    accountById,
  ]);

  const ready =
    result?.drafts.filter((d) => !d.duplicate && d.problems.length === 0) ?? [];
  const invalid = result?.drafts.filter((d) => d.problems.length > 0) ?? [];
  const duplicates = result?.drafts.filter((d) => d.duplicate).length ?? 0;
  const dateCheck =
    rows && mapping
      ? detectDateOrder(
          rows
            .slice(mapping.hasHeader ? 1 : 0)
            .map((r) => r[mapping.date] ?? ""),
          account?.country ?? "CA",
        )
      : null;

  const commit = async () => {
    if (!account || ready.length === 0) return;
    let imported = 0;
    let skipped = 0;
    try {
      for (let i = 0; i < ready.length; i += BATCH) {
        const chunk = ready.slice(i, i + BATCH).map((d) => d.draft);
        const outcome = await runImport({
          accountId: account.id,
          fileName,
          preset: null,
          rowCount: chunk.length,
          drafts: chunk,
        }).unwrap();
        imported += outcome.imported;
        skipped += outcome.duplicates;
      }
      toast.success(
        `Imported ${imported} transaction${imported === 1 ? "" : "s"}${skipped ? `, ${skipped} already there` : ""}`,
      );
      setRows(null);
      setMapping(null);
      setFileName(null);
    } catch (error) {
      toast.error("Nothing was imported", {
        description: getErrorMessage(error),
      });
    }
  };

  const header = rows && mapping?.hasHeader ? rows[0] : null;
  const width = rows ? Math.max(...rows.map((r) => r.length)) : 0;
  const columnName = (i: number) =>
    header?.[i]?.trim()
      ? header[i]
      : `Column ${i + 1}${rows?.[mapping?.hasHeader ? 1 : 0]?.[i] ? ` (e.g. ${rows[mapping?.hasHeader ? 1 : 0][i].slice(0, 20)})` : ""}`;
  const columnSelect = (
    label: string,
    key: keyof ColumnMapping,
    optional: boolean,
  ) => (
    <div className="space-y-1">
      <Label htmlFor={`map-${key}`} className="text-xs">
        {label}
      </Label>
      <Select
        value={
          mapping?.[key] == null || mapping[key] === -1
            ? NONE
            : String(mapping[key])
        }
        onValueChange={(v) =>
          setMapping((m) =>
            m
              ? { ...m, [key]: v === NONE ? (optional ? null : -1) : Number(v) }
              : m,
          )
        }
      >
        <SelectTrigger id={`map-${key}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            {optional ? "Not used" : "Choose…"}
          </SelectItem>
          {Array.from({ length: width }, (_, i) => (
            <SelectItem key={i} value={String(i)}>
              {columnName(i)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (openAccounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add the account the statement belongs to first.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-surface border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="import-account">Import into</Label>
          <AccountSelect
            id="import-account"
            value={accountId}
            onChange={(id) => {
              setAccountId(id);
              setRows(null);
              setMapping(null);
            }}
          />
        </div>
        <div>
          <Label htmlFor="import-file" className="sr-only">
            CSV file
          </Label>
          <Button asChild disabled={!account}>
            <label htmlFor="import-file" className="cursor-pointer">
              <FileUp className="mr-2 size-4" /> Choose CSV…
            </label>
          </Button>
          {/* Plain input: the styled Input's w-full would outrank sr-only and
              leave an invisible full-width box hanging off the page. */}
          <input
            id="import-file"
            type="file"
            accept=".csv,.txt,text/csv"
            className="sr-only"
            onChange={read}
            disabled={!account}
          />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Download the CSV from your bank&apos;s website (usually under
          Statements or Download transactions). Canadian and Indian bank formats
          are recognised; anything else you can map by hand below. Nothing is
          saved until you press Import.
        </p>
      </div>

      {mapping && rows && account && result && (
        <>
          <section
            className="space-y-3 rounded-surface border bg-card p-5"
            aria-labelledby="mapping-heading"
          >
            <h2 id="mapping-heading" className="font-medium">
              How {fileName} was read
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {columnSelect("Date", "date", false)}
              {columnSelect("Description", "description", false)}
              {columnSelect("More description", "descriptionExtra", true)}
              {columnSelect("Amount (signed)", "amount", true)}
              {columnSelect("Money out", "debit", true)}
              {columnSelect("Money in", "credit", true)}
              {columnSelect("Dr/Cr marker", "direction", true)}
              <div className="space-y-1">
                <Label htmlFor="map-order" className="text-xs">
                  Dates are written
                </Label>
                <Select
                  value={mapping.dateOrder}
                  onValueChange={(v) =>
                    setMapping({ ...mapping, dateOrder: v as DateOrder })
                  }
                >
                  <SelectTrigger id="map-order">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ymd">Year first (2026-02-05)</SelectItem>
                    <SelectItem value="mdy">
                      Month first (02/05/2026)
                    </SelectItem>
                    <SelectItem value="dmy">Day first (05/02/2026)</SelectItem>
                  </SelectContent>
                </Select>
                {dateCheck?.ambiguous && (
                  <p className="text-xs text-warning">
                    Every date in this file works either way — check a known
                    date below.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="map-header"
                  checked={mapping.hasHeader}
                  onCheckedChange={(v) =>
                    setMapping({ ...mapping, hasHeader: v })
                  }
                />
                <Label htmlFor="map-header" className="font-normal">
                  First row is a header
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="map-invert"
                  checked={mapping.invertSign}
                  onCheckedChange={(v) =>
                    setMapping({ ...mapping, invertSign: v })
                  }
                />
                <Label htmlFor="map-invert" className="font-normal">
                  Flip signs (purchases are positive in this file)
                </Label>
              </div>
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="preview-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="preview-heading" className="font-medium">
                {ready.length} to import · {duplicates} already in the ledger ·{" "}
                {result.statement.problems.length + invalid.length} skipped
              </h2>
              <Button
                onClick={commit}
                disabled={ready.length === 0 || importing.isLoading}
              >
                {importing.isLoading && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Import {ready.length}
              </Button>
            </div>
            {(result.statement.problems.length > 0 || invalid.length > 0) && (
              <details className="rounded-control border bg-destructive/5 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-destructive">
                  Rows that will be skipped
                </summary>
                <ul className="mt-2 space-y-1">
                  {result.statement.problems.map((p) => (
                    <li key={`p${p.line}`}>
                      Line {p.line}: {p.message}
                    </li>
                  ))}
                  {invalid.map((d) => (
                    <li key={d.draft.importHash!}>
                      {d.draft.date} {d.draft.description}:{" "}
                      {d.problems.join(" ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <ul className="divide-y rounded-surface border bg-card text-sm">
              {result.drafts
                .slice(0, 100)
                .map(({ draft, duplicate, problems }) => (
                  <li
                    key={draft.importHash!}
                    className={
                      duplicate || problems.length
                        ? "flex gap-3 px-4 py-2 opacity-50"
                        : "flex gap-3 px-4 py-2"
                    }
                  >
                    <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                      {draft.date}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {draft.description}
                      <span className="block text-xs text-muted-foreground">
                        {duplicate
                          ? "Already imported"
                          : categoryLabel(
                              draft.postings[0].categoryId,
                              categoryById,
                            )}
                      </span>
                    </span>
                    <Amount
                      minor={draft.postings[0].amountMinor}
                      currency={account.currency}
                      tone="flow"
                      signed
                    />
                  </li>
                ))}
            </ul>
            {result.drafts.length > 100 && (
              <p className="text-xs text-muted-foreground">
                Showing the first 100 of {result.drafts.length}.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
