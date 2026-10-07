"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSheet } from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import { isIsoDate } from "../domain/dates";
import { priceInBase } from "../domain/fx";
import { balances, isLiability } from "../domain/ledger";
import { money, MoneyError, parseAmount } from "../domain/money";
import type { AccountRecord } from "../data/rows";
import {
  useDeleteReconciliationMutation,
  useRecordTransactionMutation,
  useSaveReconciliationMutation,
} from "../data/money-api";
import { Amount } from "./amount";
import { useMoney } from "./money-context";

/**
 * Check an account against a statement: on this date the bank said
 * X; the ledger's cleared balance for that date is Y. A difference means a
 * missing, doubled or mistyped transaction — or, once the owner has looked,
 * something to write off with an adjustment that says so.
 */
export function ReconcileSheet({
  account,
  onOpenChange,
}: {
  account: AccountRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { today, transactions, reconciliations, settings, rateTable } =
    useMoney();
  const [asOf, setAsOf] = useState(today);
  const [statement, setStatement] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [save] = useSaveReconciliationMutation();
  const [remove] = useDeleteReconciliationMutation();
  const [record] = useRecordTransactionMutation();

  useEffect(() => {
    if (account) {
      setAsOf(today);
      setStatement("");
      setProblem(null);
    }
  }, [account, today]);

  if (!account)
    return (
      <FormSheet open={false} onOpenChange={onOpenChange} title="Reconcile">
        <span />
      </FormSheet>
    );

  const owed = isLiability(account.kind);
  const cleared = (date: string) =>
    isIsoDate(date)
      ? (balances([account], transactions, date).get(account.id)
          ?.clearedMinor ?? 0)
      : 0;

  let statementMinor: number | null = null;
  try {
    if (statement.trim()) {
      const typed = parseAmount(statement, account.currency).minor;
      // A card statement says "you owe 420"; the ledger stores −420.
      statementMinor = owed ? -Math.abs(typed) : typed;
    }
  } catch (error) {
    if (!(error instanceof MoneyError)) throw error;
  }
  const ledger = cleared(asOf);
  const difference = statementMinor === null ? null : statementMinor - ledger;
  const history = reconciliations.filter((r) => r.accountId === account.id);

  const checkpoint = async () => {
    if (statementMinor === null || !isIsoDate(asOf)) {
      setProblem("Enter the statement's date and balance.");
      return;
    }
    try {
      await save({
        accountId: account.id,
        asOf,
        statementBalanceMinor: statementMinor,
        note: null,
      }).unwrap();
      toast.success(
        difference === 0 ? "Matches the statement" : "Checkpoint saved",
      );
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  const adjust = async () => {
    if (difference === null || difference === 0) return;
    try {
      const price = priceInBase(
        money(difference, account.currency),
        settings.baseCurrency,
        asOf,
        rateTable,
      );
      await record({
        date: asOf,
        kind: "adjustment",
        description: "Balance adjustment to match statement",
        notes: `Statement balance on ${asOf}`,
        postings: [
          {
            accountId: account.id,
            categoryId: null,
            amountMinor: difference,
            fxRate: price?.fxRate ?? null,
            baseAmountMinor: price?.baseAmountMinor ?? null,
          },
        ],
      }).unwrap();
      await save({
        accountId: account.id,
        asOf,
        statementBalanceMinor: statementMinor!,
        note: "Adjusted",
      }).unwrap();
      toast.success("Adjusted to match the statement");
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  const shown = (minor: number) => (owed ? -minor : minor);

  return (
    // Never "dirty": the typed balance is scratch for a comparison, and the
    // checkpoint saves in place without a form (the unsaved-changes guard
    // would ask after every save).
    <FormSheet
      open={!!account}
      onOpenChange={onOpenChange}
      dirty={false}
      title={`Check ${account.name}`}
      description="Compare the ledger with a statement."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rec-date">Statement date</Label>
            <Input
              id="rec-date"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-balance">
              {owed ? "Balance owed" : "Closing balance"}
            </Label>
            <Input
              id="rec-balance"
              inputMode="decimal"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-control bg-secondary/50 p-3 text-sm">
          <dt className="text-muted-foreground">Ledger (cleared) on {asOf}</dt>
          <dd className="text-right font-medium">
            <Amount minor={shown(ledger)} currency={account.currency} />
          </dd>
          {difference !== null && (
            <>
              <dt className="text-muted-foreground">Difference</dt>
              <dd
                className={
                  difference === 0
                    ? "text-right font-semibold text-success"
                    : "text-right font-semibold text-destructive"
                }
              >
                {difference === 0 ? (
                  "None — it matches"
                ) : (
                  <Amount
                    minor={shown(difference)}
                    currency={account.currency}
                    signed
                  />
                )}
              </dd>
            </>
          )}
        </dl>

        {difference !== null && difference !== 0 && (
          <p className="text-sm text-muted-foreground">
            Look for a missing, doubled or mistyped transaction first — an
            import from that statement usually finds it. If the gap is real (a
            fee you never recorded, interest), you can write it off as an
            adjustment.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={checkpoint} disabled={statementMinor === null}>
            Save checkpoint
          </Button>
          {difference !== null && difference !== 0 && (
            <Button variant="outline" onClick={adjust}>
              Adjust to match
            </Button>
          )}
        </div>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}

        {history.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium">Earlier checkpoints</h3>
            <ul className="divide-y rounded-control border text-sm">
              {history.map((r) => {
                const gap = r.statementBalanceMinor - cleared(r.asOf);
                return (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1">{r.asOf}</span>
                    <Amount
                      minor={shown(r.statementBalanceMinor)}
                      currency={account.currency}
                    />
                    <span
                      className={
                        gap === 0 ? "text-success" : "text-destructive"
                      }
                    >
                      {gap === 0 ? (
                        "matches"
                      ) : (
                        <>
                          off by{" "}
                          <Amount
                            minor={Math.abs(gap)}
                            currency={account.currency}
                          />
                        </>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete checkpoint ${r.asOf}`}
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </FormSheet>
  );
}
