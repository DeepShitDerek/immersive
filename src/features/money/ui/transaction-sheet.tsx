"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FormSheet } from "@/components/admin/shared";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { getErrorMessage } from "@/lib/utils";
import {
  buildDraft,
  emptyEntry,
  type EntryForm,
  type EntryKind,
  formFromTransaction,
  suggestReceived,
} from "../domain/entry";
import { quoteAge, remittanceCost } from "../domain/fx";
import { everydayAccount, type Transaction } from "../domain/ledger";
import { money, parseAmount } from "../domain/money";
import {
  useDeleteTransactionMutation,
  useRecordTransactionMutation,
  useUpdateTransactionMutation,
} from "../data/money-api";
import { Amount } from "./amount";
import { useMoney } from "./money-context";
import { AccountSelect, CategoryPicker } from "./pickers";

const KINDS: { value: EntryKind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "refund", label: "Refund" },
];

/**
 * Add or edit one transaction. Every rule is checked by
 * `buildDraft` before sending — the same rules the database enforces — so
 * the database refusing is a bug, not the normal way to learn a mistake.
 */
export function TransactionSheet({
  open,
  onOpenChange,
  transaction,
  defaultAccountId,
  prefill,
  link,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  defaultAccountId?: string;
  /** A new transaction's starting values — a due occurrence, say. */
  prefill?: EntryForm | null;
  /** Records the transaction as this schedule occurrence. */
  link?: { scheduleId: string; occurrenceDate: string } | null;
}) {
  const data = useMoney();
  const { accountById, openAccounts, settings, rateTable, today, categories } =
    data;
  const confirm = useConfirm();
  const [record, recording] = useRecordTransactionMutation();
  const [update, updating] = useUpdateTransactionMutation();
  const [remove, removing] = useDeleteTransactionMutation();

  // A bank or transfer fees category — not any name containing "fee", which
  // picked "Permit & PR fees" for a wire charge.
  const feeCategoryDefault = useMemo(() => {
    const open = categories.filter((c) => !c.archivedAt);
    return (
      (
        open.find((c) => /^bank (&|and) transfer fees$/i.test(c.name)) ??
        open.find((c) =>
          /(bank|transfer|wire).*fee|fee.*(bank|transfer|wire)/i.test(c.name),
        ) ??
        null
      )?.id ?? null
    );
  }, [categories]);

  const initial = (): EntryForm | null => {
    if (transaction) return formFromTransaction(transaction, accountById);
    if (prefill) return prefill;
    const account =
      defaultAccountId ??
      everydayAccount(openAccounts, settings.baseCurrency)?.id ??
      "";
    return { ...emptyEntry(today, account), feeCategoryId: feeCategoryDefault };
  };
  const [form, setForm] = useState<EntryForm | null>(initial);
  const [problems, setProblems] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  // A fresh form every time the sheet opens, for whichever transaction.
  useEffect(() => {
    if (open) {
      setForm(initial());
      setProblems([]);
      setTried(false);
    }
  }, [open, transaction?.id, prefill]);

  const set = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const result = useMemo(
    () =>
      form
        ? buildDraft(form, accountById, settings.baseCurrency, rateTable)
        : null,
    [form, accountById, settings.baseCurrency, rateTable],
  );

  const busy = recording.isLoading || updating.isLoading || removing.isLoading;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!result?.draft) {
      setProblems(result?.problems ?? ["Nothing to save."]);
      return;
    }
    setProblems([]);
    try {
      if (transaction)
        await update({ id: transaction.id, ...result.draft }).unwrap();
      else await record({ ...result.draft, ...(link ?? {}) }).unwrap();
      toast.success(transaction ? "Transaction updated" : "Transaction saved");
      onOpenChange(false);
    } catch (error) {
      setProblems([getErrorMessage(error)]);
    }
  };

  const destroy = async () => {
    if (!transaction) return;
    const ok = await confirm({
      title: "Delete this transaction?",
      description:
        "Every amount in it is removed, and balances change to match.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await remove(transaction.id).unwrap();
      toast.success("Transaction deleted");
      onOpenChange(false);
    } catch (error) {
      toast.error("Couldn't delete it", {
        description: getErrorMessage(error),
      });
    }
  };

  const title = transaction
    ? "Edit transaction"
    : link
      ? "Record a due payment"
      : "New transaction";

  // Written by a trade: edited there, so the two never disagree.
  if (transaction && data.tradeTransactionIds.has(transaction.id)) {
    return (
      <FormSheet open={open} onOpenChange={onOpenChange} title="From a trade">
        <p className="text-sm text-muted-foreground">
          This was recorded as a dividend, interest, fee or reinvested
          distribution in an investment account. Change or delete it under
          Investing, where the trade lives.
        </p>
      </FormSheet>
    );
  }

  if (!form) {
    return (
      <FormSheet open={open} onOpenChange={onOpenChange} title={title}>
        <p className="text-sm text-muted-foreground">
          This transaction has a shape the form can&apos;t show without losing
          part of it (an adjustment, or a transfer with more than two accounts).
          Delete it and enter it again if it needs to change.
        </p>
        {transaction && (
          <Button
            variant="destructive"
            className="mt-4"
            onClick={destroy}
            disabled={busy}
          >
            <Trash2 className="mr-2 size-4" /> Delete
          </Button>
        )}
      </FormSheet>
    );
  }

  const from = accountById.get(form.fromAccountId);
  const to = accountById.get(form.toAccountId);
  const cross =
    form.kind === "transfer" && from && to && from.currency !== to.currency;
  const suggestion = cross
    ? suggestReceived(
        form.amountOut,
        from.currency,
        to.currency,
        form.date,
        rateTable,
      )
    : null;
  const marketQuote = cross
    ? rateTable.quote(from.currency, to.currency, form.date)
    : null;
  const account = accountById.get(form.accountId);
  // Server errors always; the form's own only once a save was attempted, so
  // an empty form does not open covered in complaints.
  const shownProblems =
    problems.length > 0 ? problems : tried ? (result?.problems ?? []) : [];

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <div className="flex gap-2">
          {transaction && (
            <Button
              type="button"
              variant="outline"
              onClick={destroy}
              disabled={busy}
              aria-label="Delete transaction"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            form="money-transaction"
            className="flex-1"
            disabled={busy}
          >
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {transaction ? "Save changes" : "Save"}
          </Button>
        </div>
      }
    >
      <form
        id="money-transaction"
        onSubmit={submit}
        className="space-y-5"
        noValidate
      >
        <ToggleGroup
          type="single"
          value={form.kind}
          onValueChange={(value) => value && set("kind", value as EntryKind)}
          className="grid grid-cols-4"
          aria-label="Kind of transaction"
        >
          {KINDS.map((kind) => (
            <ToggleGroupItem
              key={kind.value}
              value={kind.value}
              className="text-xs sm:text-sm"
            >
              {kind.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="txn-date">Date</Label>
            <Input
              id="txn-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="txn-payee">
              {form.kind === "income"
                ? "From"
                : form.kind === "transfer"
                  ? "Service (optional)"
                  : "Payee"}
            </Label>
            {form.kind === "transfer" ? (
              <Input
                id="txn-payee"
                value={form.provider}
                onChange={(e) => set("provider", e.target.value)}
                placeholder="e.g. Wise, Remitly"
              />
            ) : (
              <Input
                id="txn-payee"
                value={form.payee}
                onChange={(e) => set("payee", e.target.value)}
                placeholder={
                  form.kind === "income" ? "Employer" : "Store or person"
                }
              />
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="txn-description">Description</Label>
          <Input
            id="txn-description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={200}
            placeholder={
              form.kind === "transfer"
                ? "e.g. Money for parents"
                : "What was it?"
            }
          />
        </div>

        {form.kind === "transfer" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="txn-from">From</Label>
                <AccountSelect
                  id="txn-from"
                  value={form.fromAccountId || null}
                  onChange={(id) => set("fromAccountId", id ?? "")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="txn-to">To</Label>
                <AccountSelect
                  id="txn-to"
                  value={form.toAccountId || null}
                  onChange={(id) => set("toAccountId", id ?? "")}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="txn-out">
                  {cross
                    ? `Sent (${from.currency})`
                    : `Amount${from ? ` (${from.currency})` : ""}`}
                </Label>
                <Input
                  id="txn-out"
                  inputMode="decimal"
                  value={form.amountOut}
                  onChange={(e) => set("amountOut", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {cross && (
                <div className="space-y-1.5">
                  <Label htmlFor="txn-in">Received ({to.currency})</Label>
                  <Input
                    id="txn-in"
                    inputMode="decimal"
                    value={form.amountIn}
                    onChange={(e) => set("amountIn", e.target.value)}
                    placeholder="What actually arrived"
                  />
                  {suggestion && !form.amountIn && (
                    <button
                      type="button"
                      className="text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => set("amountIn", suggestion.amount)}
                    >
                      Use {suggestion.amount} (market rate{" "}
                      {suggestion.rate.toFixed(4)})
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="txn-fee">
                  Fee{from ? ` (${from.currency})` : ""}, if any
                </Label>
                <Input
                  id="txn-fee"
                  inputMode="decimal"
                  value={form.fee}
                  onChange={(e) => set("fee", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {form.fee.trim() && (
                <div className="space-y-1.5">
                  <Label htmlFor="txn-fee-category">Fee category</Label>
                  <CategoryPicker
                    id="txn-fee-category"
                    value={form.feeCategoryId}
                    onChange={(id) => set("feeCategoryId", id)}
                    allowNone={false}
                  />
                </div>
              )}
            </div>
            {cross && (
              <div className="space-y-1.5">
                <Label htmlFor="txn-market">
                  Mid-market rate ({to.currency} per {from.currency})
                </Label>
                <Input
                  id="txn-market"
                  inputMode="decimal"
                  value={form.marketRate}
                  onChange={(e) => set("marketRate", e.target.value)}
                  placeholder={
                    marketQuote ? marketQuote.rate.toFixed(4) : "e.g. 61.25"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {marketQuote
                    ? `The ECB rate for ${marketQuote.asOf}${quoteAge(marketQuote, form.date) > 0 ? ` (${quoteAge(marketQuote, form.date)} days before this date)` : ""} was ${marketQuote.rate.toFixed(4)}. `
                    : "No stored rate for this date. "}
                  With it, the ledger can tell you what this transfer really
                  cost.
                </p>
                <RemittancePreview
                  form={form}
                  fromCurrency={from.currency}
                  toCurrency={to.currency}
                  fallbackRate={marketQuote?.rate ?? null}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="txn-account">
                {form.kind === "expense" ? "Paid from" : "Paid into"}
              </Label>
              <AccountSelect
                id="txn-account"
                value={form.accountId || null}
                onChange={(id) => set("accountId", id ?? "")}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-sm font-medium">
                {form.lines.length > 1
                  ? "Split between categories"
                  : "Amount and category"}
              </legend>
              {form.lines.map((line, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-2"
                >
                  <Input
                    aria-label={`Amount${form.lines.length > 1 ? ` on line ${index + 1}` : ""}${account ? ` in ${account.currency}` : ""}`}
                    inputMode="decimal"
                    value={line.amount}
                    placeholder="0.00"
                    onChange={(e) =>
                      set(
                        "lines",
                        form.lines.map((l, i) =>
                          i === index ? { ...l, amount: e.target.value } : l,
                        ),
                      )
                    }
                  />
                  <CategoryPicker
                    aria-label={`Category${form.lines.length > 1 ? ` of line ${index + 1}` : ""}`}
                    value={line.categoryId}
                    buckets={
                      form.kind === "income"
                        ? ["income"]
                        : form.kind === "expense" || form.kind === "refund"
                          ? ["need", "want", "save"]
                          : undefined
                    }
                    onChange={(id) =>
                      set(
                        "lines",
                        form.lines.map((l, i) =>
                          i === index ? { ...l, categoryId: id } : l,
                        ),
                      )
                    }
                  />
                  {form.lines.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove line ${index + 1}`}
                      onClick={() =>
                        set(
                          "lines",
                          form.lines.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  ) : (
                    <span className="w-9" />
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2"
                onClick={() =>
                  set("lines", [
                    ...form.lines,
                    { categoryId: null, amount: "", memo: "" },
                  ])
                }
              >
                <Plus className="mr-1 size-4" /> Split
              </Button>
              {form.lines.length > 1 && account && (
                <SplitTotal form={form} currency={account.currency} />
              )}
            </fieldset>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="txn-notes">Notes</Label>
          <Textarea
            id="txn-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            maxLength={2000}
          />
        </div>

        <div className="flex items-center justify-between rounded-control border px-3 py-2.5">
          <Label htmlFor="txn-pending" className="font-normal">
            Pending — not cleared by the bank yet
          </Label>
          <Switch
            id="txn-pending"
            checked={form.pending}
            onCheckedChange={(checked) => set("pending", checked)}
          />
        </div>

        {shownProblems.length > 0 && (
          <ul
            role="alert"
            className="space-y-1 rounded-control bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {shownProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </form>
    </FormSheet>
  );
}

function SplitTotal({ form, currency }: { form: EntryForm; currency: string }) {
  let total = 0;
  for (const line of form.lines) {
    try {
      if (line.amount.trim())
        total += Math.abs(parseAmount(line.amount, currency).minor);
    } catch {
      return null;
    }
  }
  return (
    <p className="text-sm text-muted-foreground">
      Total{" "}
      <Amount
        minor={total}
        currency={currency}
        className="font-medium text-foreground"
      />
    </p>
  );
}

/** What this transfer cost against the market, once enough is typed. */
function RemittancePreview({
  form,
  fromCurrency,
  toCurrency,
  fallbackRate,
}: {
  form: EntryForm;
  fromCurrency: string;
  toCurrency: string;
  fallbackRate: number | null;
}) {
  try {
    const rate = form.marketRate.trim()
      ? Number(form.marketRate)
      : fallbackRate;
    if (!rate || !(rate > 0) || !form.amountOut.trim() || !form.amountIn.trim())
      return null;
    const cost = remittanceCost({
      sent: parseAmount(form.amountOut, fromCurrency),
      received: parseAmount(form.amountIn, toCurrency),
      fee: form.fee.trim()
        ? parseAmount(form.fee, fromCurrency)
        : money(0, fromCurrency),
      marketRate: rate,
    });
    return (
      <p className="rounded-control bg-secondary/60 px-3 py-2 text-sm">
        You got {cost.deliveredRate.toFixed(4)} {toCurrency} per {fromCurrency}.
        Against the market rate this cost{" "}
        <Amount
          minor={cost.totalCost.minor}
          currency={fromCurrency}
          className="font-semibold"
        />{" "}
        ({(cost.costRatio * 100).toFixed(2)}%)
        {form.fee.trim() ? ", fee included" : ""}.
      </p>
    );
  } catch {
    return null;
  }
}
