"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Trade } from "../domain/invest";
import { Amount } from "./amount";
import { useMoney } from "./money-context";
import { AccountSelect } from "./pickers";
import { TRADE_KIND_LABEL, TradeSheet } from "./trade-sheet";

/** Every trade, newest first, by account. */
export function TradesPanel() {
  const { trades, accounts, accountById, securityById } = useMoney();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Trade | "new" | null>(null);
  const investment = accounts.filter((a) => a.kind === "investment");

  const shown = useMemo(
    () =>
      trades
        .filter((t) => !accountId || t.accountId === accountId)
        .sort((a, b) =>
          a.date === b.date
            ? b.createdAt.localeCompare(a.createdAt)
            : a.date < b.date
              ? 1
              : -1,
        ),
    [trades, accountId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {investment.length > 1 ? (
          <div className="w-64">
            <AccountSelect
              id="trades-account"
              value={accountId}
              onChange={setAccountId}
              accounts={investment}
              allowNone
              noneLabel="All investment accounts"
            />
          </div>
        ) : (
          <span />
        )}
        <Button onClick={() => setEditing("new")}>
          <Plus className="mr-2 size-4" /> Trade
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
          No trades yet. Record buys and sells from your broker&apos;s
          confirmations, and dividends as they arrive.
        </p>
      ) : (
        <ul className="divide-y rounded-surface border bg-card text-sm">
          {shown.map((t) => {
            const account = accountById.get(t.accountId);
            const security = t.securityId
              ? securityById.get(t.securityId)
              : undefined;
            const currency = account?.currency ?? "CAD";
            const cash =
              t.kind === "buy"
                ? -(t.amountMinor + t.feeMinor)
                : t.kind === "sell"
                  ? t.amountMinor - t.feeMinor
                  : t.kind === "fee"
                    ? -t.amountMinor
                    : t.kind === "split" || t.kind === "reinvest"
                      ? null
                      : t.amountMinor;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/40"
                  onClick={() => setEditing(t)}
                >
                  <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                    {t.date}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {TRADE_KIND_LABEL[t.kind]}
                      {security ? ` · ${security.symbol}` : ""}
                      {t.quantity != null
                        ? t.kind === "split"
                          ? ` · ${t.quantity}-for-1`
                          : ` · ${t.quantity} units`
                        : ""}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {account?.name}
                    </span>
                  </span>
                  <span className="text-right">
                    {cash !== null ? (
                      <Amount minor={cash} currency={currency} tone="balance" />
                    ) : t.kind === "reinvest" ? (
                      <Amount minor={t.amountMinor} currency={currency} />
                    ) : null}
                    {t.feeMinor > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        incl. <Amount minor={t.feeMinor} currency={currency} />{" "}
                        commission
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <TradeSheet
        trade={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        defaultAccountId={accountId}
      />
    </div>
  );
}
