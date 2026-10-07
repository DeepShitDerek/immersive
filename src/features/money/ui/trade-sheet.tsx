"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { FormSheet } from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import { isIsoDate } from "../domain/dates";
import {
  LEDGER_TRADE_KINDS,
  replay,
  roundUnits,
  type Trade,
  TRADE_KINDS,
  type TradeKind,
  UNIT_TRADE_KINDS,
  validateTrade,
} from "../domain/invest";
import type { Bucket } from "../domain/model";
import {
  convert,
  exponentOf,
  money,
  MoneyError,
  parseAmount,
  roundHalfAwayFromZero,
  toInputString,
} from "../domain/money";
import {
  useDeleteTradeMutation,
  useSaveTradeMutation,
} from "../data/money-api";
import { Amount } from "./amount";
import { useMoney } from "./money-context";
import { AccountSelect, CategoryPicker } from "./pickers";

export const TRADE_KIND_LABEL: Record<TradeKind, string> = {
  buy: "Buy",
  sell: "Sell",
  reinvest: "Reinvested distribution (DRIP)",
  dividend: "Dividend or distribution",
  interest: "Interest",
  fee: "Account fee",
  return_of_capital: "Return of capital",
  split: "Split",
};

const INCOME: readonly Bucket[] = ["income"];
const SPENDING: readonly Bucket[] = ["need", "want", "save"];

/** One trade in an investment account. */
export function TradeSheet({
  trade,
  open,
  onOpenChange,
  defaultAccountId,
}: {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId?: string | null;
}) {
  const {
    openAccounts,
    accountById,
    securities,
    securityById,
    trades,
    transactions,
    categories,
    settings,
    rateTable,
    today,
  } = useMoney();
  const [save, saving] = useSaveTradeMutation();
  const [remove, removing] = useDeleteTradeMutation();
  const investmentAccounts = openAccounts.filter(
    (a) => a.kind === "investment",
  );

  const [accountId, setAccountId] = useState<string | null>(null);
  const [kind, setKind] = useState<TradeKind>("buy");
  const [date, setDate] = useState(today);
  const [securityId, setSecurityId] = useState<string | null>(null);
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [total, setTotal] = useState("");
  const [fee, setFee] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const defaultCategory = (k: TradeKind): string | null => {
    const live = categories.filter((c) => !c.archivedAt);
    const find = (re: RegExp, buckets: readonly Bucket[]) =>
      live.find((c) => re.test(c.name) && buckets.includes(c.bucket))?.id ??
      null;
    if (k === "dividend" || k === "reinvest") return find(/dividend/i, INCOME);
    if (k === "interest")
      return find(/^interest$/i, INCOME) ?? find(/interest/i, INCOME);
    if (k === "fee")
      return (
        find(/invest.*fee/i, SPENDING) ??
        find(/^bank (&|and) transfer fees$/i, SPENDING)
      );
    return null;
  };

  useEffect(() => {
    if (!open) return;
    const account =
      trade?.accountId ?? defaultAccountId ?? investmentAccounts[0]?.id ?? null;
    const currency = account ? accountById.get(account)?.currency : undefined;
    setAccountId(account);
    setKind(trade?.kind ?? "buy");
    setDate(trade?.date ?? today);
    setSecurityId(trade?.securityId ?? null);
    setUnits(trade?.quantity != null ? String(trade.quantity) : "");
    setPrice("");
    setTotal(
      trade && currency && trade.kind !== "split"
        ? toInputString(money(trade.amountMinor, currency))
        : "",
    );
    setFee(
      trade?.feeMinor && currency
        ? toInputString(money(trade.feeMinor, currency))
        : "",
    );
    setCategoryId(null);
    setDescription("");
    setProblem(null);
    // Only when the sheet opens, or for another trade.
  }, [open, trade?.id]);

  // The category and wording of an income or fee trade live on its ledger transaction.
  useEffect(() => {
    if (!open) return;
    const txn = trade?.transactionId
      ? transactions.find((t) => t.id === trade.transactionId)
      : undefined;
    setCategoryId(
      txn
        ? (txn.postings[0]?.categoryId ?? null)
        : defaultCategory(trade?.kind ?? "buy"),
    );
    setDescription(txn?.description ?? "");
  }, [open, trade?.id]);

  const account = accountId ? accountById.get(accountId) : undefined;
  const currency = account?.currency ?? settings.baseCurrency;
  const choices = securities.filter((x) => x.currency === currency);
  const needsUnits = UNIT_TRADE_KINDS.includes(kind);
  const inLedger = LEDGER_TRADE_KINDS.includes(kind);
  const hasPrice = kind === "buy" || kind === "sell" || kind === "reinvest";
  const hasFee = kind === "buy" || kind === "sell";

  // What the price and units come to, when the total is left blank.
  const computedTotal = useMemo(() => {
    const u = Number(units);
    const p = Number(price.replace(/,/g, ""));
    if (!hasPrice || !units.trim() || !price.trim() || !(u > 0) || !(p > 0))
      return null;
    return roundHalfAwayFromZero(u * p * 10 ** exponentOf(currency));
  }, [units, price, hasPrice, currency]);

  // Units held on the trade's date, without this trade.
  const held = useMemo(() => {
    if (!accountId || !securityId || !isIsoDate(date)) return null;
    const others = trades.filter(
      (t) => t.accountId === accountId && t.id !== trade?.id,
    );
    return replay(others, date).positions.get(securityId)?.units ?? 0;
  }, [accountId, securityId, date, trades, trade?.id]);

  const changeKind = (next: TradeKind) => {
    setKind(next);
    setCategoryId(defaultCategory(next));
    if (next === "interest" || next === "fee") setSecurityId(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    if (!account) return setProblem("Choose an investment account.");
    if (!isIsoDate(date)) return setProblem("Choose the date.");
    if (date < account.openingDate)
      return setProblem(`The account starts on ${account.openingDate}.`);
    let quantity: number | null = null;
    if (needsUnits) {
      quantity = roundUnits(Number(units));
      if (!units.trim() || !Number.isFinite(quantity) || quantity <= 0)
        return setProblem(
          kind === "split"
            ? "Enter how many new units each old one becomes (a 2-for-1 split is 2)."
            : "Enter how many units.",
        );
    }
    let amountMinor = 0;
    let feeMinor = 0;
    try {
      if (kind !== "split") {
        amountMinor = total.trim()
          ? parseAmount(total, currency).minor
          : (computedTotal ?? -1);
        if (amountMinor < 0)
          return setProblem(
            hasPrice
              ? "Enter the price per unit or the total."
              : "Enter the amount.",
          );
      }
      if (hasFee && fee.trim()) feeMinor = parseAmount(fee, currency).minor;
    } catch (error) {
      return setProblem(
        error instanceof MoneyError ? error.message : "Unreadable amount.",
      );
    }
    const shape = validateTrade({
      kind,
      securityId,
      quantity,
      amountMinor,
      feeMinor,
    });
    if (shape.length) return setProblem(shape[0]);
    if (kind === "sell" && held !== null && quantity! > held + 1e-8)
      return setProblem(`Only ${held} units were held on ${date}.`);
    if (kind === "split" && held === 0)
      return setProblem(`None were held on ${date} to split.`);

    let fxRate: number | null = null;
    let baseAmountMinor: number | null = null;
    if (inLedger && currency !== settings.baseCurrency) {
      const quote = rateTable.quote(currency, settings.baseCurrency, date);
      if (quote) {
        fxRate = quote.rate;
        baseAmountMinor = convert(
          money(amountMinor, currency),
          quote.rate,
          settings.baseCurrency,
        ).minor;
      }
    }
    const symbol = securityId ? securityById.get(securityId)?.symbol : null;
    try {
      await save({
        id: trade?.id,
        accountId: account.id,
        securityId: kind === "interest" || kind === "fee" ? null : securityId,
        date,
        kind,
        quantity,
        amountMinor,
        feeMinor,
        notes: trade?.notes ?? null,
        categoryId: inLedger ? categoryId : null,
        description: inLedger
          ? description.trim() ||
            `${TRADE_KIND_LABEL[kind]}${symbol ? ` — ${symbol}` : ""}`
          : null,
        fxRate,
        baseAmountMinor,
      }).unwrap();
      toast.success(
        trade ? "Trade saved" : `${TRADE_KIND_LABEL[kind]} recorded`,
      );
      onOpenChange(false);
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  const destroy = async () => {
    if (!trade) return;
    try {
      await remove(trade.id).unwrap();
      toast.success("Trade deleted");
      onOpenChange(false);
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  if (investmentAccounts.length === 0 && !trade) {
    return (
      <FormSheet open={open} onOpenChange={onOpenChange} title="Record a trade">
        <p className="text-sm text-muted-foreground">
          Trades go in an investment account. Add one on the Accounts screen
          (type: Investment) — a TFSA, RRSP, FHSA or non-registered brokerage
          account, one per currency.
        </p>
      </FormSheet>
    );
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={trade ? "Edit trade" : "Record a trade"}
      footer={
        <div className="flex gap-2">
          {trade && (
            <Button
              type="button"
              variant="outline"
              aria-label="Delete trade"
              onClick={destroy}
              disabled={removing.isLoading}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            form="money-trade"
            className="flex-1"
            disabled={saving.isLoading}
          >
            {saving.isLoading && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Save
          </Button>
        </div>
      }
    >
      <form id="money-trade" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tr-account">Account</Label>
            <AccountSelect
              id="tr-account"
              value={accountId}
              onChange={(id) => (setAccountId(id), setSecurityId(null))}
              accounts={investmentAccounts}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-date">Date</Label>
            <Input
              id="tr-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr-kind">What happened</Label>
          <Select
            value={kind}
            onValueChange={(v) => changeKind(v as TradeKind)}
          >
            <SelectTrigger id="tr-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRADE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {TRADE_KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {kind !== "interest" && kind !== "fee" && (
          <div className="space-y-1.5">
            <Label htmlFor="tr-security">Security</Label>
            {choices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No securities in {currency} yet — add one under Investing →
                Securities &amp; prices.
              </p>
            ) : (
              <Select
                value={securityId ?? undefined}
                onValueChange={setSecurityId}
              >
                <SelectTrigger id="tr-security">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.symbol} — {x.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {held !== null && (kind === "sell" || kind === "split") && (
              <p className="text-xs text-muted-foreground">
                {held} units held on {date}.
              </p>
            )}
          </div>
        )}

        {needsUnits && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-units">
                {kind === "split" ? "New units per old unit" : "Units"}
              </Label>
              <Input
                id="tr-units"
                inputMode="decimal"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder={kind === "split" ? "2" : ""}
              />
            </div>
            {hasPrice && (
              <div className="space-y-1.5">
                <Label htmlFor="tr-price">Price per unit ({currency})</Label>
                <Input
                  id="tr-price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {kind !== "split" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-total">
                {hasPrice ? `Total (${currency})` : `Amount (${currency})`}
              </Label>
              <Input
                id="tr-total"
                inputMode="decimal"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder={
                  computedTotal !== null
                    ? toInputString(money(computedTotal, currency))
                    : "0.00"
                }
              />
            </div>
            {hasFee && (
              <div className="space-y-1.5">
                <Label htmlFor="tr-fee">Commission</Label>
                <Input
                  id="tr-fee"
                  inputMode="decimal"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
        )}
        {computedTotal !== null && !total.trim() && (
          <p className="-mt-3 text-xs text-muted-foreground">
            Total: <Amount minor={computedTotal} currency={currency} /> (units ×
            price). Type a total to use the exact figure from your confirmation.
          </p>
        )}

        {inLedger && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="tr-category">Category</Label>
              <CategoryPicker
                id="tr-category"
                value={categoryId}
                onChange={setCategoryId}
                buckets={kind === "fee" ? SPENDING : INCOME}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-description">Description</Label>
              <Input
                id="tr-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                placeholder={TRADE_KIND_LABEL[kind]}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {kind === "reinvest"
                ? "Counts as income in the ledger and buys the units with it — the cash never leaves the account."
                : kind === "fee"
                  ? "Recorded as spending in the ledger."
                  : "Recorded as income in the ledger."}
            </p>
          </>
        )}
        {kind === "return_of_capital" && (
          <p className="text-xs text-muted-foreground">
            Lowers the cost base instead of counting as income — from box 42 of
            a T3, or the fund&apos;s tax breakdown.
          </p>
        )}
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </form>
    </FormSheet>
  );
}
