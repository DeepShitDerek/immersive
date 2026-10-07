"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Briefcase, Plus, Trash2 } from "lucide-react";
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
import { daysBetween, isIsoDate } from "../domain/dates";
import type { IncomeSource } from "../domain/lender-report";
import { money, parseAmount, toInputString } from "../domain/money";
import {
  useDeleteIncomeSourceMutation,
  useSaveIncomeSourceMutation,
} from "../data/money-api";
import { Amount } from "./amount";
import { ALL_CURRENCIES, countryLabel } from "./labels";
import { useMoney } from "./money-context";

export const EMPLOYMENT_LABEL: Record<IncomeSource["employment"], string> = {
  full_time: "Full-time, permanent",
  part_time: "Part-time",
  contract: "Contract",
  self_employed: "Self-employed",
  other: "Other",
};

/** Who pays you, and the gross figure lenders use. */
export function IncomePanel() {
  const { incomeSources, today } = useMoney();
  const [editing, setEditing] = useState<IncomeSource | "new" | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Your deposits show take-home pay. Lenders qualify you on{" "}
          <strong>gross</strong> income, and look at how long you have been with
          the employer (and whether probation is over).
        </p>
        <Button onClick={() => setEditing("new")}>
          <Plus className="mr-2 size-4" /> Income
        </Button>
      </div>
      {incomeSources.length === 0 ? (
        <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Briefcase aria-hidden className="mx-auto mb-2 size-5" />
          Add your job — employer, gross salary, start date.
        </p>
      ) : (
        <ul className="divide-y rounded-surface border bg-card text-sm">
          {incomeSources.map((s) => {
            const months = Math.floor(
              daysBetween(
                s.startDate,
                s.endDate && s.endDate < today ? s.endDate : today,
              ) / 30.4375,
            );
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40"
                  onClick={() => setEditing(s)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {s.name}
                      {s.role ? ` — ${s.role}` : ""}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {EMPLOYMENT_LABEL[s.employment]} ·{" "}
                      {countryLabel(s.country)} · since {s.startDate} (
                      {Math.floor(months / 12)}y {months % 12}m)
                      {s.endDate ? ` · ended ${s.endDate}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <Amount
                      minor={s.grossAnnualMinor}
                      currency={s.currency}
                      className="font-semibold"
                    />
                    <span className="block text-xs text-muted-foreground">
                      a year, gross
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <IncomeSheet
        source={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}

function IncomeSheet({
  source,
  open,
  onOpenChange,
}: {
  source: IncomeSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { settings, today } = useMoney();
  const [save, saving] = useSaveIncomeSourceMutation();
  const [remove] = useDeleteIncomeSourceMutation();
  const [form, setForm] = useState({
    name: "",
    role: "",
    employment: "full_time" as IncomeSource["employment"],
    gross: "",
    currency: settings.baseCurrency,
    startDate: today,
    endDate: "",
    country: "CA",
    notes: "",
  });
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: source?.name ?? "",
      role: source?.role ?? "",
      employment: source?.employment ?? "full_time",
      gross: source
        ? toInputString(money(source.grossAnnualMinor, source.currency))
        : "",
      currency: source?.currency ?? settings.baseCurrency,
      startDate: source?.startDate ?? today,
      endDate: source?.endDate ?? "",
      country: source?.country ?? "CA",
      notes: source?.notes ?? "",
    });
    setProblem(null);
  }, [open, source, settings.baseCurrency, today]);
  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return setProblem("Name the employer or source.");
    let gross: number;
    try {
      gross = parseAmount(form.gross, form.currency).minor;
      if (gross <= 0) throw new Error("has to be more than zero");
    } catch (error) {
      return setProblem(
        `Gross yearly income: ${error instanceof Error ? error.message : "unreadable"}`,
      );
    }
    if (!isIsoDate(form.startDate)) return setProblem("Choose the start date.");
    if (
      form.endDate &&
      (!isIsoDate(form.endDate) || form.endDate < form.startDate)
    )
      return setProblem("The end date has to come after the start.");
    try {
      await save({
        id: source?.id,
        name: form.name,
        role: form.role || null,
        employment: form.employment,
        grossAnnualMinor: gross,
        currency: form.currency,
        startDate: form.startDate,
        endDate: form.endDate || null,
        country: form.country,
        notes: form.notes || null,
      }).unwrap();
      toast.success("Income saved");
      onOpenChange(false);
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={source ? `Edit ${source.name}` : "Income source"}
      footer={
        <div className="flex gap-2">
          {source && (
            <Button
              type="button"
              variant="outline"
              aria-label="Delete income source"
              onClick={() => remove(source.id).then(() => onOpenChange(false))}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            form="money-income"
            className="flex-1"
            disabled={saving.isLoading}
          >
            Save
          </Button>
        </div>
      }
    >
      <form
        id="money-income"
        onSubmit={submit}
        className="space-y-5"
        noValidate
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inc-name">Employer or source</Label>
            <Input
              id="inc-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-role">Role</Label>
            <Input
              id="inc-role"
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              maxLength={120}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-employment">Employment</Label>
          <Select
            value={form.employment}
            onValueChange={(v) => set("employment", v)}
          >
            <SelectTrigger id="inc-employment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.keys(EMPLOYMENT_LABEL) as IncomeSource["employment"][]
              ).map((k) => (
                <SelectItem key={k} value={k}>
                  {EMPLOYMENT_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inc-gross">Gross a year (before tax)</Label>
            <Input
              id="inc-gross"
              inputMode="decimal"
              value={form.gross}
              onChange={(e) => set("gross", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-currency">Currency</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => set("currency", v)}
            >
              <SelectTrigger id="inc-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inc-start">Started</Label>
            <Input
              id="inc-start"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-end">Ended</Label>
            <Input
              id="inc-end"
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-country">Country</Label>
            <Select
              value={form.country}
              onValueChange={(v) => set("country", v)}
            >
              <SelectTrigger id="inc-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["CA", "IN", "US", "GB", "AE"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {countryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </form>
    </FormSheet>
  );
}
