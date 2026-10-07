"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/components/admin/shared";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { getErrorMessage } from "@/lib/utils";
import {
  ACCOUNT_KINDS,
  type AccountKind,
  CANADIAN_REGISTRATIONS,
  CREDIT_KINDS,
  INDIAN_REGISTRATIONS,
  isLiability,
  type Registration,
  validateAccount,
} from "../domain/ledger";
import { money, MoneyError, parseAmount, toInputString } from "../domain/money";
import type { AccountRecord } from "../data/rows";
import {
  useDeleteAccountMutation,
  useSaveAccountMutation,
  useSaveInstitutionMutation,
  useSetAccountArchivedMutation,
} from "../data/money-api";
import { useMoney } from "./money-context";
import {
  ACCOUNT_KIND_LABEL,
  ALL_CURRENCIES,
  countryLabel,
  REGISTRATION_HINT,
  REGISTRATION_LABEL,
} from "./labels";

const NEW_INSTITUTION = "__new__";
const NO_INSTITUTION = "__none__";

interface AccountForm {
  name: string;
  kind: AccountKind;
  country: string;
  currency: string;
  registration: Registration;
  institutionId: string | null;
  newInstitution: string;
  /** Typed as a positive "owed" figure for liabilities. */
  opening: string;
  openingDate: string;
  creditLimit: string;
  statementDay: string;
  paymentDueDay: string;
  interestRate: string;
  isLiquid: boolean;
  inNetWorth: boolean;
  importRef: string;
  notes: string;
}

const blank = (today: string, currency: string): AccountForm => ({
  name: "",
  kind: "chequing",
  country: "CA",
  currency,
  registration: "none",
  institutionId: null,
  newInstitution: "",
  opening: "",
  openingDate: today,
  creditLimit: "",
  statementDay: "",
  paymentDueDay: "",
  interestRate: "",
  isLiquid: true,
  inNetWorth: true,
  importRef: "",
  notes: "",
});

function fromAccount(a: AccountRecord): AccountForm {
  const owed = isLiability(a.kind);
  return {
    name: a.name,
    kind: a.kind,
    country: a.country,
    currency: a.currency,
    registration: a.registration,
    institutionId: a.institutionId,
    newInstitution: "",
    opening:
      a.openingBalanceMinor === 0
        ? ""
        : toInputString(
            money(
              owed ? -a.openingBalanceMinor : a.openingBalanceMinor,
              a.currency,
            ),
          ),
    openingDate: a.openingDate,
    creditLimit: a.creditLimitMinor
      ? toInputString(money(a.creditLimitMinor, a.currency))
      : "",
    statementDay: a.statementDay ? String(a.statementDay) : "",
    paymentDueDay: a.paymentDueDay ? String(a.paymentDueDay) : "",
    interestRate: a.interestRate != null ? String(a.interestRate) : "",
    isLiquid: a.isLiquid,
    inNetWorth: a.inNetWorth,
    importRef: a.importRef ?? "",
    notes: a.notes ?? "",
  };
}

const LIQUID_BY_DEFAULT: AccountKind[] = [
  "chequing",
  "savings",
  "cash",
  "wallet",
  "credit_card",
  "line_of_credit",
];

function day(text: string): number | null | "bad" {
  if (!text.trim()) return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : "bad";
}

export function AccountSheet({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountRecord | null;
}) {
  const { today, settings, institutions, transactions } = useMoney();
  const confirm = useConfirm();
  const [save, saving] = useSaveAccountMutation();
  const [saveInstitution] = useSaveInstitutionMutation();
  const [archive] = useSetAccountArchivedMutation();
  const [remove] = useDeleteAccountMutation();
  const [form, setForm] = useState<AccountForm>(() =>
    blank(today, settings.baseCurrency),
  );
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setForm(
        account ? fromAccount(account) : blank(today, settings.baseCurrency),
      );
      setProblems([]);
    }
  }, [open, account, today, settings.baseCurrency]);

  const set = <K extends keyof AccountForm>(key: K, value: AccountForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const hasHistory = account
    ? transactions.some((t) =>
        t.postings.some((p) => p.accountId === account.id),
      )
    : false;
  const credit = CREDIT_KINDS.includes(form.kind);
  const owed = isLiability(form.kind);
  const registrations: Registration[] = [
    "none",
    ...(form.country === "CA"
      ? CANADIAN_REGISTRATIONS
      : form.country === "IN"
        ? INDIAN_REGISTRATIONS
        : []),
  ];

  const changeKind = (kind: AccountKind) =>
    setForm((f) => ({
      ...f,
      kind,
      isLiquid: account ? f.isLiquid : LIQUID_BY_DEFAULT.includes(kind),
      registration: ["chequing", "savings", "investment", "cash"].includes(kind)
        ? f.registration
        : "none",
    }));

  const changeCountry = (country: string) =>
    setForm((f) => ({
      ...f,
      country,
      currency:
        account && hasHistory
          ? f.currency
          : country === "IN"
            ? "INR"
            : country === "CA"
              ? "CAD"
              : f.currency,
      registration: "none",
    }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: string[] = [];
    const amount = (text: string, what: string): number | null => {
      if (!text.trim()) return null;
      try {
        return parseAmount(text, form.currency).minor;
      } catch (error) {
        found.push(
          `${what}: ${error instanceof MoneyError ? error.message : "unreadable"}`,
        );
        return null;
      }
    };
    const opening =
      amount(form.opening, owed ? "Amount owed" : "Opening balance") ?? 0;
    const limit = credit ? amount(form.creditLimit, "Credit limit") : null;
    const statementDay = credit ? day(form.statementDay) : null;
    const paymentDueDay = credit ? day(form.paymentDueDay) : null;
    if (statementDay === "bad" || paymentDueDay === "bad")
      found.push("Statement and due days are 1–31.");
    const rate = form.interestRate.trim() ? Number(form.interestRate) : null;
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100))
      found.push("Interest rate is a percentage from 0 to 100.");
    if (form.importRef && !/^[0-9A-Za-z]{2,8}$/.test(form.importRef))
      found.push("Account number ending: 2–8 letters or digits.");
    if (!form.openingDate)
      found.push("Choose the date the opening balance is from.");

    const record = {
      name: form.name,
      kind: form.kind,
      registration: form.registration,
      country: form.country,
      currency: form.currency,
      institutionId: form.institutionId,
      // Liabilities are stored as negative balances: typed "owed 420" is −420.
      openingBalanceMinor: owed ? -Math.abs(opening) : opening,
      openingDate: form.openingDate,
      creditLimitMinor: limit,
      statementDay: statementDay === "bad" ? null : statementDay,
      paymentDueDay: paymentDueDay === "bad" ? null : paymentDueDay,
      interestRate: rate,
      isLiquid: form.isLiquid,
      inNetWorth: form.inNetWorth,
      importRef: form.importRef || null,
      color: account?.color ?? null,
      notes: form.notes,
      sortOrder: account?.sortOrder ?? 0,
    };
    found.push(...validateAccount(record));
    if (found.length > 0) {
      setProblems(found);
      return;
    }
    try {
      let institutionId = record.institutionId;
      if (form.institutionId === NEW_INSTITUTION) {
        if (!form.newInstitution.trim()) {
          setProblems(["Name the new bank or institution."]);
          return;
        }
        institutionId = (
          await saveInstitution({
            name: form.newInstitution,
            country: form.country,
            notes: null,
          }).unwrap()
        ).id;
      }
      await save({ ...record, institutionId, id: account?.id }).unwrap();
      toast.success(account ? "Account updated" : "Account added");
      onOpenChange(false);
    } catch (error) {
      setProblems([getErrorMessage(error)]);
    }
  };

  const toggleArchive = async () => {
    if (!account) return;
    try {
      await archive({ id: account.id, archived: !account.archivedAt }).unwrap();
      toast.success(
        account.archivedAt ? "Account restored" : "Account archived",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const destroy = async () => {
    if (!account) return;
    const ok = await confirm({
      title: `Delete ${account.name}?`,
      description: "It has no transactions, so nothing else changes.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await remove({ id: account.id }).unwrap();
      toast.success("Account deleted");
      onOpenChange(false);
    } catch (error) {
      toast.error("Couldn't delete it", {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={account ? `Edit ${account.name}` : "Add an account"}
      description="A bank account, card, loan, investment or wallet — in Canada, India or anywhere else."
      footer={
        <div className="flex gap-2">
          {account &&
            (hasHistory ? (
              <Button type="button" variant="outline" onClick={toggleArchive}>
                {account.archivedAt ? (
                  <ArchiveRestore className="mr-2 size-4" />
                ) : (
                  <Archive className="mr-2 size-4" />
                )}
                {account.archivedAt ? "Restore" : "Archive"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={destroy}
                aria-label="Delete account"
              >
                <Trash2 className="size-4" />
              </Button>
            ))}
          <Button
            type="submit"
            form="money-account"
            className="flex-1"
            disabled={saving.isLoading}
          >
            {saving.isLoading && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            {account ? "Save changes" : "Add account"}
          </Button>
        </div>
      }
    >
      <form
        id="money-account"
        onSubmit={submit}
        className="space-y-5"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="acct-name">Name</Label>
          <Input
            id="acct-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={120}
            placeholder="e.g. RBC Chequing, HDFC NRO"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="acct-kind">Type</Label>
            <Select
              value={form.kind}
              onValueChange={(v) => changeKind(v as AccountKind)}
            >
              <SelectTrigger id="acct-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {ACCOUNT_KIND_LABEL[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct-country">Country</Label>
            <Select value={form.country} onValueChange={changeCountry}>
              <SelectTrigger id="acct-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["CA", "IN", "US", "GB", "AE"].map((code) => (
                  <SelectItem key={code} value={code}>
                    {countryLabel(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="acct-currency">Currency</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => set("currency", v)}
              disabled={hasHistory}
            >
              <SelectTrigger id="acct-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasHistory && (
              <p className="text-xs text-muted-foreground">
                Fixed once it has transactions.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct-registration">Tax registration</Label>
            <Select
              value={form.registration}
              onValueChange={(v) => set("registration", v as Registration)}
              disabled={registrations.length === 1}
            >
              <SelectTrigger id="acct-registration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {registrations.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REGISTRATION_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {REGISTRATION_HINT[form.registration] && (
          <p className="-mt-3 text-xs text-muted-foreground">
            {REGISTRATION_HINT[form.registration]}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="acct-institution">Bank or institution</Label>
          <Select
            value={form.institutionId ?? NO_INSTITUTION}
            onValueChange={(v) =>
              set("institutionId", v === NO_INSTITUTION ? null : v)
            }
          >
            <SelectTrigger id="acct-institution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_INSTITUTION}>None</SelectItem>
              {institutions.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_INSTITUTION}>New…</SelectItem>
            </SelectContent>
          </Select>
          {form.institutionId === NEW_INSTITUTION && (
            <Input
              aria-label="New institution name"
              value={form.newInstitution}
              onChange={(e) => set("newInstitution", e.target.value)}
              placeholder="e.g. Scotiabank, ICICI Bank"
              maxLength={120}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="acct-opening">
              {owed ? "Amount owed on that date" : "Balance on that date"}
            </Label>
            <Input
              id="acct-opening"
              inputMode="decimal"
              value={form.opening}
              onChange={(e) => set("opening", e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct-opening-date">Starting from</Label>
            <Input
              id="acct-opening-date"
              type="date"
              value={form.openingDate}
              onChange={(e) => set("openingDate", e.target.value)}
              disabled={hasHistory}
            />
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          The balance your statement shows on that date. Everything before it
          stays out of the ledger; everything after is entered or imported.
        </p>

        {credit && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acct-limit">Limit</Label>
              <Input
                id="acct-limit"
                inputMode="decimal"
                value={form.creditLimit}
                onChange={(e) => set("creditLimit", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-statement">Statement day</Label>
              <Input
                id="acct-statement"
                inputMode="numeric"
                value={form.statementDay}
                onChange={(e) => set("statementDay", e.target.value)}
                placeholder="1–31"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-due">Due day</Label>
              <Input
                id="acct-due"
                inputMode="numeric"
                value={form.paymentDueDay}
                onChange={(e) => set("paymentDueDay", e.target.value)}
                placeholder="1–31"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="acct-rate">Interest rate % (optional)</Label>
            <Input
              id="acct-rate"
              inputMode="decimal"
              value={form.interestRate}
              onChange={(e) => set("interestRate", e.target.value)}
              placeholder={credit ? "e.g. 20.99" : "e.g. 3.5"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct-ref">Account number ends in</Label>
            <Input
              id="acct-ref"
              value={form.importRef}
              onChange={(e) => set("importRef", e.target.value)}
              placeholder="For imports"
              maxLength={8}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-control border px-3 py-2.5">
            <Label htmlFor="acct-liquid" className="font-normal">
              Spendable within days (counts as cash on hand)
            </Label>
            <Switch
              id="acct-liquid"
              checked={form.isLiquid}
              onCheckedChange={(v) => set("isLiquid", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-control border px-3 py-2.5">
            <Label htmlFor="acct-networth" className="font-normal">
              Include in net worth
            </Label>
            <Switch
              id="acct-networth"
              checked={form.inNetWorth}
              onCheckedChange={(v) => set("inNetWorth", v)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="acct-notes">Notes</Label>
          <Textarea
            id="acct-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            maxLength={1000}
          />
        </div>

        {problems.length > 0 && (
          <ul
            role="alert"
            className="space-y-1 rounded-control bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </form>
    </FormSheet>
  );
}
