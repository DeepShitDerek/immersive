"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
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
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/utils";
import { recentInquiries } from "../domain/applications";
import { isIsoDate } from "../domain/dates";
import { creditUtilisation } from "../domain/ledger";
import type { CreditScore } from "../domain/lender-report";
import {
  useDeleteCreditScoreMutation,
  useSaveCreditScoreMutation,
} from "../data/money-api";
import { Amount } from "./amount";
import { useMoney } from "./money-context";

const BUREAU: Record<CreditScore["bureau"], string> = {
  equifax: "Equifax",
  transunion: "TransUnion",
  other: "Other",
};

/**
 * Credit in Canada: the score over time, how much of the card
 * limits is in use, and the hard inquiries on file. A newcomer's file
 * starts empty — Indian credit history does not carry over — so these are
 * the levers that build it.
 */
export function CreditPanel() {
  const {
    creditScores,
    accounts,
    balanceByAccount,
    accountById,
    applications,
    today,
  } = useMoney();
  const [save] = useSaveCreditScoreMutation();
  const [remove] = useDeleteCreditScoreMutation();
  const [bureau, setBureau] = useState<CreditScore["bureau"]>("equifax");
  const [score, setScore] = useState("");
  const [asOf, setAsOf] = useState(today);
  const [source, setSource] = useState("");

  const util = creditUtilisation(accounts, balanceByAccount);
  const inquiries = recentInquiries(applications, today);
  const sorted = [...creditScores].sort((a, b) => b.asOf.localeCompare(a.asOf));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(score);
    if (!Number.isInteger(value) || value < 300 || value > 900)
      return toast.error("A Canadian score is between 300 and 900.");
    if (!isIsoDate(asOf)) return toast.error("Choose the date of the score.");
    try {
      await save({
        bureau,
        score: value,
        asOf,
        source: source || null,
      }).unwrap();
      setScore("");
      toast.success("Score saved");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="util-heading"
        className="rounded-surface border bg-card p-5"
      >
        <h3 id="util-heading" className="font-heading text-base font-semibold">
          Card utilisation
        </h3>
        {util.cards.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No cards with a credit limit yet. A first secured or newcomer card
            is usually how a Canadian file starts.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {util.cards.map((card) => (
              <li key={card.accountId}>
                <div className="flex justify-between">
                  <span>{accountById.get(card.accountId)?.name}</span>
                  <span
                    className={cn(
                      card.ratio > 0.3 && "font-semibold text-warning",
                    )}
                  >
                    {Math.round(card.ratio * 100)}% ·{" "}
                    <Amount
                      minor={card.usedMinor}
                      currency={
                        accountById.get(card.accountId)?.currency ?? "CAD"
                      }
                    />{" "}
                    of{" "}
                    <Amount
                      minor={card.limitMinor}
                      currency={
                        accountById.get(card.accountId)?.currency ?? "CAD"
                      }
                    />
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"
                  aria-hidden
                >
                  <div
                    className={cn(
                      "h-full",
                      card.ratio > 0.3 ? "bg-warning" : "bg-success",
                    )}
                    style={{ width: `${Math.min(100, card.ratio * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          What counts is the balance on the statement date. Under 30% of the
          limit is healthy; under 10% scores best. Paying before the statement
          closes lowers it without paying more.
        </p>
      </section>

      <section aria-labelledby="scores-heading" className="space-y-3">
        <h3
          id="scores-heading"
          className="font-heading text-base font-semibold"
        >
          Score history
        </h3>
        <form
          onSubmit={submit}
          className="flex flex-wrap items-end gap-3 rounded-surface border bg-card p-4"
          noValidate
        >
          <div className="space-y-1">
            <Label htmlFor="score-bureau" className="text-xs">
              Bureau
            </Label>
            <Select
              value={bureau}
              onValueChange={(v) => setBureau(v as CreditScore["bureau"])}
            >
              <SelectTrigger id="score-bureau" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BUREAU) as CreditScore["bureau"][]).map((b) => (
                  <SelectItem key={b} value={b}>
                    {BUREAU[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="score-value" className="text-xs">
              Score
            </Label>
            <Input
              id="score-value"
              inputMode="numeric"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-24"
              placeholder="300–900"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="score-date" className="text-xs">
              On
            </Label>
            <Input
              id="score-date"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="score-source" className="text-xs">
              From
            </Label>
            <Input
              id="score-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Borrowell"
              maxLength={80}
            />
          </div>
          <Button type="submit" variant="outline">
            Add score
          </Button>
        </form>
        {sorted.length > 0 && (
          <ul className="divide-y rounded-surface border bg-card text-sm">
            {sorted.map((s, i) => {
              const previous = sorted
                .slice(i + 1)
                .find((p) => p.bureau === s.bureau);
              const change = previous ? s.score - previous.score : null;
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-24 tabular-nums text-muted-foreground">
                    {s.asOf}
                  </span>
                  <span className="flex-1">
                    {BUREAU[s.bureau]}
                    {s.source ? ` · ${s.source}` : ""}
                  </span>
                  <span className="font-semibold tabular-nums">{s.score}</span>
                  <span
                    className={cn(
                      "w-12 text-right text-xs tabular-nums",
                      change && change > 0
                        ? "text-success"
                        : change && change < 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {change === null ? "" : change > 0 ? `+${change}` : change}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete score from ${s.asOf}`}
                    onClick={() => remove(s.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="inquiries-heading"
        className="rounded-surface border bg-card p-5 text-sm"
      >
        <h3
          id="inquiries-heading"
          className="font-heading text-base font-semibold"
        >
          Hard inquiries, last 12 months
        </h3>
        <p className="mt-2">
          {inquiries.length === 0
            ? "None recorded."
            : `${inquiries.length}: ${inquiries.join(", ")}.`}{" "}
          <span className="text-muted-foreground">
            Each application for new credit adds one; several close together
            cost points. They come from the applications you log.
          </span>
        </p>
      </section>
    </div>
  );
}
