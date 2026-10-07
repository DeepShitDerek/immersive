"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import { isIsoDate } from "../domain/dates";
import {
  type Compounding,
  PAYMENT_FREQUENCIES,
  type PaymentFrequency,
  scheduledPayment,
} from "../domain/loan";
import { money, MoneyError, parseAmount, toInputString } from "../domain/money";
import type { AccountRecord, Loan } from "../data/rows";
import { useDeleteLoanMutation, useSaveLoanMutation } from "../data/money-api";
import { Amount } from "./amount";
import { useMoney } from "./money-context";

export const FREQUENCY_TEXT: Record<PaymentFrequency, string> = {
  monthly: "Monthly",
  semimonthly: "Twice a month",
  biweekly: "Every two weeks",
  accelerated_biweekly: "Accelerated bi-weekly",
  weekly: "Weekly",
  accelerated_weekly: "Accelerated weekly",
};

/** The terms of one debt account. */
export function LoanSheet({
  account,
  open,
  onOpenChange,
}: {
  account: AccountRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { loanByAccount, balanceByAccount } = useMoney();
  const [save, saving] = useSaveLoanMutation();
  const [remove] = useDeleteLoanMutation();
  const loan = account ? loanByAccount.get(account.id) : undefined;
  const currency = account?.currency ?? "CAD";

  const [lender, setLender] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [rateType, setRateType] = useState<Loan["rateType"]>("fixed");
  const [compounding, setCompounding] = useState<Compounding>("monthly");
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [payment, setPayment] = useState("");
  const [amortYears, setAmortYears] = useState("");
  const [termYears, setTermYears] = useState("");
  const [firstPayment, setFirstPayment] = useState("");
  const [allowance, setAllowance] = useState("");
  const [notes, setNotes] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !account) return;
    const owed = Math.max(
      0,
      -(balanceByAccount.get(account.id)?.balanceMinor ?? 0),
    );
    const mortgage = account.kind === "mortgage";
    setLender(loan?.lender ?? "");
    setPrincipal(
      loan
        ? toInputString(money(loan.principalMinor, currency))
        : owed
          ? toInputString(money(owed, currency))
          : "",
    );
    setRate(
      loan
        ? String(loan.annualRate)
        : account.interestRate != null
          ? String(account.interestRate)
          : "",
    );
    setRateType(loan?.rateType ?? "fixed");
    // Canadian fixed-rate mortgages compound semi-annually by law.
    setCompounding(
      loan?.compounding ??
        (mortgage
          ? "semiannual"
          : account.kind === "line_of_credit"
            ? "daily"
            : "monthly"),
    );
    setFrequency(loan?.frequency ?? "monthly");
    setPayment(
      loan?.paymentMinor
        ? toInputString(money(loan.paymentMinor, currency))
        : "",
    );
    setAmortYears(
      loan
        ? String(+(loan.amortizationMonths / 12).toFixed(2))
        : mortgage
          ? "25"
          : "5",
    );
    setTermYears(
      loan?.termMonths
        ? String(+(loan.termMonths / 12).toFixed(2))
        : mortgage
          ? "5"
          : "",
    );
    setFirstPayment(loan?.firstPaymentDate ?? account.openingDate);
    setAllowance(
      loan?.prepaymentAllowancePct != null
        ? String(loan.prepaymentAllowancePct)
        : mortgage
          ? "15"
          : "",
    );
    setNotes(loan?.notes ?? "");
    setProblem(null);
  }, [open, account, loan, balanceByAccount, currency]);

  if (!account) return null;

  const build = (): Omit<Loan, "id"> | string => {
    let principalMinor: number;
    let paymentMinor: number | null = null;
    try {
      principalMinor = parseAmount(principal, currency).minor;
      if (principalMinor <= 0)
        return "What you borrowed has to be more than zero.";
      if (payment.trim()) {
        paymentMinor = parseAmount(payment, currency).minor;
        if (paymentMinor <= 0) return "The payment has to be more than zero.";
      }
    } catch (error) {
      return error instanceof MoneyError ? error.message : "Unreadable amount.";
    }
    const r = Number(rate);
    if (!rate.trim() || !Number.isFinite(r) || r < 0 || r > 100)
      return "Interest rate is a percentage from 0 to 100.";
    const amort = Math.round(Number(amortYears) * 12);
    if (!Number.isFinite(amort) || amort < 1 || amort > 600)
      return "Amortization is between 1 month and 50 years.";
    const term = termYears.trim() ? Math.round(Number(termYears) * 12) : null;
    if (term !== null && (!Number.isFinite(term) || term < 1 || term > amort))
      return "The term has to fit inside the amortization.";
    if (!isIsoDate(firstPayment)) return "Choose the first payment date.";
    const pct = allowance.trim() ? Number(allowance) : null;
    if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100))
      return "Prepayment allowance is a percentage.";
    return {
      accountId: account.id,
      lender: lender || null,
      principalMinor,
      annualRate: r,
      rateType,
      compounding,
      frequency,
      paymentMinor,
      amortizationMonths: amort,
      termMonths: term,
      firstPaymentDate: firstPayment,
      prepaymentAllowancePct: pct,
      notes: notes || null,
    };
  };

  const preview = build();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const terms = build();
    if (typeof terms === "string") return setProblem(terms);
    try {
      await save({ ...terms, id: loan?.id }).unwrap();
      toast.success("Loan terms saved");
      onOpenChange(false);
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Terms of ${account.name}`}
      description="From your loan agreement or mortgage commitment."
      footer={
        <div className="flex gap-2">
          {loan && (
            <Button
              type="button"
              variant="outline"
              aria-label="Remove terms"
              onClick={() => remove(loan.id).then(() => onOpenChange(false))}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            form="money-loan"
            className="flex-1"
            disabled={saving.isLoading}
          >
            {saving.isLoading && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Save terms
          </Button>
        </div>
      }
    >
      <form id="money-loan" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="loan-lender">Lender</Label>
            <Input
              id="loan-lender"
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loan-principal">Borrowed ({currency})</Label>
            <Input
              id="loan-principal"
              inputMode="decimal"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="loan-rate">Rate %</Label>
            <Input
              id="loan-rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loan-rate-type">Type</Label>
            <Select
              value={rateType}
              onValueChange={(v) => setRateType(v as Loan["rateType"])}
            >
              <SelectTrigger id="loan-rate-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="variable">Variable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loan-compounding">Compounds</Label>
            <Select
              value={compounding}
              onValueChange={(v) => setCompounding(v as Compounding)}
            >
              <SelectTrigger id="loan-compounding">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semiannual">Semi-annually</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {account.kind === "mortgage" &&
          compounding !== "semiannual" &&
          rateType === "fixed" && (
            <p className="-mt-3 text-xs text-warning">
              Canadian fixed-rate mortgages compound semi-annually by law —
              check your commitment letter.
            </p>
          )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="loan-frequency">Payments</Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as PaymentFrequency)}
            >
              <SelectTrigger id="loan-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCY_TEXT[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loan-payment">Payment (blank = calculate)</Label>
            <Input
              id="loan-payment"
              inputMode="decimal"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="loan-amort">Amortization (years)</Label>
            <Input
              id="loan-amort"
              inputMode="decimal"
              value={amortYears}
              onChange={(e) => setAmortYears(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loan-term">Term (years)</Label>
            <Input
              id="loan-term"
              inputMode="decimal"
              value={termYears}
              onChange={(e) => setTermYears(e.target.value)}
              placeholder="none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loan-first">First payment</Label>
            <Input
              id="loan-first"
              type="date"
              value={firstPayment}
              onChange={(e) => setFirstPayment(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loan-allowance">
            Yearly prepayment allowed without penalty (% of original)
          </Label>
          <Input
            id="loan-allowance"
            inputMode="decimal"
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
            placeholder="e.g. 15"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loan-notes">Notes</Label>
          <Textarea
            id="loan-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
          />
        </div>
        {typeof preview !== "string" && (
          <p className="rounded-control bg-secondary/60 px-3 py-2 text-sm">
            Payment:{" "}
            <Amount
              minor={scheduledPayment(preview)}
              currency={currency}
              className="font-semibold"
            />{" "}
            {FREQUENCY_TEXT[preview.frequency].toLowerCase()}
            {preview.paymentMinor
              ? " (as your lender set it)"
              : " (calculated)"}
            .
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
