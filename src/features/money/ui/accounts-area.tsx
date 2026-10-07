"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { convert, money } from "../domain/money";
import { creditUtilisation, isLiability } from "../domain/ledger";
import type { AccountRecord } from "../data/rows";
import { AccountSheet } from "./account-sheet";
import { Amount } from "./amount";
import {
  ACCOUNT_GROUPS,
  ACCOUNT_KIND_LABEL,
  countryLabel,
  REGISTRATION_LABEL,
} from "./labels";
import { useMoney } from "./money-context";
import { ReconcileSheet } from "./reconcile-sheet";

/**
 * Every account, grouped, with what it holds today. A liability
 * shows what is owed as a positive figure with the word "owed", rather than
 * a minus sign someone has to interpret.
 */
export function AccountsArea({
  onOpenRegister,
}: {
  onOpenRegister: (accountId: string) => void;
}) {
  const {
    accounts,
    balanceByAccount,
    worthByAccount,
    institutions,
    settings,
    rateTable,
    today,
  } = useMoney();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<AccountRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [reconciling, setReconciling] = useState<AccountRecord | null>(null);

  const institutionName = useMemo(
    () => new Map(institutions.map((i) => [i.id, i.name])),
    [institutions],
  );
  const shown = accounts.filter((a) => showArchived || !a.archivedAt);
  const utilisation = creditUtilisation(accounts, balanceByAccount);
  const utilisationById = new Map(
    utilisation.cards.map((c) => [c.accountId, c]),
  );

  if (accounts.length === 0) {
    return (
      <div className="rounded-surface border border-dashed p-8 text-center">
        <h2 className="font-heading text-lg font-semibold">
          Start with the accounts you have
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your Canadian chequing and card, your savings, and your accounts back
          home — each in its own currency. Balances are worked out from the
          balance you start with plus everything after it.
        </p>
        <Button className="mt-5" onClick={() => setAdding(true)}>
          <Plus className="mr-2 size-4" /> Add your first account
        </Button>
        <AccountSheet open={adding} onOpenChange={setAdding} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived" className="font-normal">
            Show archived
          </Label>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="mr-2 size-4" /> Add account
        </Button>
      </div>

      {ACCOUNT_GROUPS.map((group) => {
        const members = shown.filter((a) => group.kinds.includes(a.kind));
        if (members.length === 0) return null;
        let groupTotal = 0;
        let unpriced = false;
        for (const account of members) {
          const balance = worthByAccount.get(account.id)?.balanceMinor ?? 0;
          const quote = rateTable.quote(
            account.currency,
            settings.baseCurrency,
            today,
          );
          if (!quote) {
            if (balance !== 0) unpriced = true;
            continue;
          }
          groupTotal += convert(
            money(balance, account.currency),
            quote.rate,
            settings.baseCurrency,
          ).minor;
        }
        return (
          <section key={group.label} aria-labelledby={`group-${group.label}`}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2
                id={`group-${group.label}`}
                className="font-heading text-base font-semibold"
              >
                {group.label}
              </h2>
              <span className="text-sm text-muted-foreground">
                {/* A debt group reads like its rows: what is owed, as a
                    positive amount and the word, not a red negative. Owing on
                    a loan is not an alarm; overspending is. */}
                {members.every((a) => isLiability(a.kind)) &&
                groupTotal <= 0 ? (
                  <>
                    <Amount
                      minor={-groupTotal}
                      currency={settings.baseCurrency}
                      className="text-foreground"
                    />{" "}
                    owed
                  </>
                ) : (
                  <Amount
                    minor={groupTotal}
                    currency={settings.baseCurrency}
                    tone="balance"
                  />
                )}
                {unpriced && " + unconverted"}
              </span>
            </div>
            <ul className="divide-y rounded-surface border bg-card">
              {members.map((account) => {
                const balance = worthByAccount.get(account.id);
                const liability = isLiability(account.kind);
                const util = utilisationById.get(account.id);
                const quote =
                  account.currency !== settings.baseCurrency
                    ? rateTable.quote(
                        account.currency,
                        settings.baseCurrency,
                        today,
                      )
                    : null;
                return (
                  <li
                    key={account.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
                      account.archivedAt && "opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenRegister(account.id)}
                      className="min-w-0 flex-1 text-left focus-ring rounded-control"
                    >
                      <span className="block truncate font-medium">
                        {account.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[
                          ACCOUNT_KIND_LABEL[account.kind],
                          account.registration !== "none"
                            ? REGISTRATION_LABEL[account.registration]
                            : null,
                          account.institutionId
                            ? institutionName.get(account.institutionId)
                            : null,
                          countryLabel(account.country),
                          account.archivedAt ? "Archived" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                    <div className="text-right">
                      <div className="font-semibold">
                        {liability && (balance?.balanceMinor ?? 0) <= 0 ? (
                          <>
                            <Amount
                              minor={-(balance?.balanceMinor ?? 0)}
                              currency={account.currency}
                            />{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              owed
                            </span>
                          </>
                        ) : (
                          <Amount
                            minor={balance?.balanceMinor ?? 0}
                            currency={account.currency}
                            tone="balance"
                          />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quote && balance && (
                          <>
                            ≈{" "}
                            <Amount
                              minor={
                                convert(
                                  money(balance.balanceMinor, account.currency),
                                  quote.rate,
                                  settings.baseCurrency,
                                ).minor
                              }
                              currency={settings.baseCurrency}
                            />
                          </>
                        )}
                        {!quote &&
                          account.currency !== settings.baseCurrency &&
                          "No exchange rate yet"}
                        {util && (
                          <span
                            className={cn(util.ratio > 0.3 && "text-warning")}
                          >
                            {Math.round(util.ratio * 100)}% of limit used
                          </span>
                        )}
                        {balance &&
                          balance.balanceMinor !== balance.clearedMinor && (
                            <span className="block">
                              <Amount
                                minor={
                                  balance.balanceMinor - balance.clearedMinor
                                }
                                currency={account.currency}
                              />{" "}
                              pending
                            </span>
                          )}
                      </div>
                    </div>
                    {/* Row actions in one menu (G5): an unlabelled scale icon and a
                        text "Edit" sat side by side on every row. Opening the
                        register stays the row itself. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions: ${account.name}`}
                        >
                          <MoreHorizontal aria-hidden className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setReconciling(account)}
                        >
                          <Scale aria-hidden className="mr-2 size-4" />
                          Check against a statement
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing(account)}>
                          <Pencil aria-hidden className="mr-2 size-4" />
                          Edit account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {utilisation.overallRatio !== null && utilisation.cards.length > 1 && (
        <p className="text-sm text-muted-foreground">
          Across all cards you are using{" "}
          {Math.round(utilisation.overallRatio * 100)}% of your combined limit.
          Credit bureaus treat under 30% as healthy and under 10% as best.
        </p>
      )}

      <AccountSheet
        open={adding || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setEditing(null);
          }
        }}
        account={editing}
      />
      <ReconcileSheet
        account={reconciling}
        onOpenChange={(o) => !o && setReconciling(null)}
      />
    </div>
  );
}
