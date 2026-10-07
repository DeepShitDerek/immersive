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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FormSheet } from "@/components/admin/shared";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { getErrorMessage } from "@/lib/utils";
import { isIsoDate } from "../domain/dates";
import { everydayAccount } from "../domain/ledger";
import { money, MoneyError, parseAmount, toInputString } from "../domain/money";
import {
  FREQUENCIES,
  type Frequency,
  type Schedule,
  type ScheduleKind,
} from "../domain/schedule";
import {
  useDeleteScheduleMutation,
  useSaveScheduleMutation,
  useSetScheduleArchivedMutation,
} from "../data/money-api";
import { useMoney } from "./money-context";
import { AccountSelect, CategoryPicker } from "./pickers";

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  once: "Once",
  weekly: "Every week",
  biweekly: "Every two weeks",
  semimonthly: "Twice a month",
  monthly: "Every month",
  quarterly: "Every three months",
  yearly: "Every year",
};

interface ScheduleForm {
  name: string;
  kind: ScheduleKind;
  accountId: string;
  toAccountId: string;
  categoryId: string | null;
  amount: string;
  toAmount: string;
  isEstimate: boolean;
  frequency: Frequency;
  startDate: string;
  endDate: string;
  dayOne: string;
  dayTwo: string;
  payee: string;
  notes: string;
}

/**
 * Add or edit something that repeats: pay, rent, bills,
 * subscriptions, a monthly transfer home.
 */
export function ScheduleSheet({
  schedule,
  open,
  onOpenChange,
}: {
  schedule: Schedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { openAccounts, accountById, today, settings } = useMoney();
  const confirm = useConfirm();
  const [save, saving] = useSaveScheduleMutation();
  const [archive] = useSetScheduleArchivedMutation();
  const [remove] = useDeleteScheduleMutation();
  const [problems, setProblems] = useState<string[]>([]);

  const fresh = (): ScheduleForm => {
    if (schedule) {
      const from = accountById.get(schedule.accountId);
      const to = schedule.toAccountId
        ? accountById.get(schedule.toAccountId)
        : undefined;
      return {
        name: schedule.name,
        kind: schedule.kind,
        accountId: schedule.accountId,
        toAccountId: schedule.toAccountId ?? "",
        categoryId: schedule.categoryId,
        amount: toInputString(
          money(schedule.amountMinor, from?.currency ?? "CAD"),
        ),
        toAmount:
          schedule.toAmountMinor && to
            ? toInputString(money(schedule.toAmountMinor, to.currency))
            : "",
        isEstimate: schedule.isEstimate,
        frequency: schedule.frequency,
        startDate: schedule.startDate,
        endDate: schedule.endDate ?? "",
        dayOne: schedule.dayOne ? String(schedule.dayOne) : "",
        dayTwo: schedule.dayTwo ? String(schedule.dayTwo) : "",
        payee: schedule.payee ?? "",
        notes: schedule.notes ?? "",
      };
    }
    return {
      name: "",
      kind: "expense",
      accountId: everydayAccount(openAccounts, settings.baseCurrency)?.id ?? "",
      toAccountId: "",
      categoryId: null,
      amount: "",
      toAmount: "",
      isEstimate: false,
      frequency: "monthly",
      startDate: today,
      endDate: "",
      dayOne: "15",
      dayTwo: "31",
      payee: "",
      notes: "",
    };
  };
  const [form, setForm] = useState<ScheduleForm>(fresh);
  useEffect(() => {
    if (open) {
      setForm(fresh());
      setProblems([]);
    }
    // Re-seed only when the sheet opens for a (different) schedule.
  }, [open, schedule?.id]);
  const set = <K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const from = accountById.get(form.accountId);
  const to = accountById.get(form.toAccountId);
  const cross =
    form.kind === "transfer" && from && to && from.currency !== to.currency;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: string[] = [];
    if (!form.name.trim()) found.push("Give it a name.");
    if (!from) found.push("Choose the account.");
    if (form.kind === "transfer" && !to)
      found.push("Choose where the money goes.");
    if (form.kind === "transfer" && to && from && to.id === from.id)
      found.push("Choose two different accounts.");
    const amount = (
      text: string,
      currency: string | undefined,
      what: string,
    ): number | null => {
      if (!currency) return null;
      try {
        const minor = parseAmount(text, currency).minor;
        if (minor <= 0) throw new MoneyError("has to be more than zero");
        return minor;
      } catch (error) {
        found.push(
          `${what}: ${error instanceof MoneyError ? error.message : "unreadable"}`,
        );
        return null;
      }
    };
    const amountMinor = amount(form.amount, from?.currency, "Amount");
    const toAmountMinor = cross
      ? amount(form.toAmount, to?.currency, "Amount that arrives")
      : null;
    if (!isIsoDate(form.startDate)) found.push("Choose the first date.");
    if (
      form.endDate &&
      (!isIsoDate(form.endDate) || form.endDate < form.startDate)
    )
      found.push("The last date has to come after the first.");
    let dayOne: number | null = null;
    let dayTwo: number | null = null;
    if (form.frequency === "semimonthly") {
      dayOne = Number(form.dayOne);
      dayTwo = Number(form.dayTwo);
      if (
        ![dayOne, dayTwo].every(
          (d) => Number.isInteger(d) && d >= 1 && d <= 31,
        ) ||
        dayOne === dayTwo
      ) {
        found.push(
          "Twice a month needs two different days, 1–31 (31 = last day).",
        );
      }
    }
    if (found.length) {
      setProblems(found);
      return;
    }
    try {
      await save({
        id: schedule?.id,
        name: form.name,
        kind: form.kind,
        accountId: form.accountId,
        toAccountId: form.kind === "transfer" ? form.toAccountId : null,
        categoryId: form.kind === "transfer" ? null : form.categoryId,
        amountMinor: amountMinor!,
        toAmountMinor,
        isEstimate: form.isEstimate,
        frequency: form.frequency,
        startDate: form.startDate,
        endDate: form.endDate || null,
        dayOne,
        dayTwo,
        payee: form.payee || null,
        notes: form.notes || null,
      }).unwrap();
      toast.success(schedule ? "Schedule updated" : "Schedule added");
      onOpenChange(false);
    } catch (error) {
      setProblems([getErrorMessage(error)]);
    }
  };

  const destroy = async () => {
    if (!schedule) return;
    const ok = await confirm({
      title: `Delete ${schedule.name}?`,
      description:
        "Transactions it recorded stay in the ledger; they just stop being linked to it.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await remove(schedule.id).unwrap();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={schedule ? `Edit ${schedule.name}` : "Something that repeats"}
      description="Pay, rent, bills, subscriptions, a regular transfer home."
      footer={
        <div className="flex gap-2">
          {schedule && (
            <>
              <Button
                type="button"
                variant="outline"
                aria-label="Delete schedule"
                onClick={destroy}
              >
                <Trash2 className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  archive({
                    id: schedule.id,
                    archived: !schedule.archivedAt,
                  }).then(() => onOpenChange(false))
                }
              >
                {schedule.archivedAt ? (
                  <ArchiveRestore className="mr-2 size-4" />
                ) : (
                  <Archive className="mr-2 size-4" />
                )}
                {schedule.archivedAt ? "Resume" : "Pause"}
              </Button>
            </>
          )}
          <Button
            type="submit"
            form="money-schedule"
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
      <form
        id="money-schedule"
        onSubmit={submit}
        className="space-y-5"
        noValidate
      >
        <ToggleGroup
          type="single"
          value={form.kind}
          onValueChange={(v) => v && set("kind", v as ScheduleKind)}
          className="grid grid-cols-3"
          aria-label="Kind"
        >
          <ToggleGroupItem value="expense">Bill or expense</ToggleGroupItem>
          <ToggleGroupItem value="income">Income</ToggleGroupItem>
          <ToggleGroupItem value="transfer">Transfer</ToggleGroupItem>
        </ToggleGroup>
        <div className="space-y-1.5">
          <Label htmlFor="sch-name">Name</Label>
          <Input
            id="sch-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={120}
            placeholder={
              form.kind === "income"
                ? "e.g. Paycheque"
                : form.kind === "transfer"
                  ? "e.g. Money for parents"
                  : "e.g. Rent, Phone, Netflix"
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sch-account">
              {form.kind === "income" ? "Paid into" : "Paid from"}
            </Label>
            <AccountSelect
              id="sch-account"
              value={form.accountId || null}
              onChange={(id) => set("accountId", id ?? "")}
            />
          </div>
          {form.kind === "transfer" ? (
            <div className="space-y-1.5">
              <Label htmlFor="sch-to">To</Label>
              <AccountSelect
                id="sch-to"
                value={form.toAccountId || null}
                onChange={(id) => set("toAccountId", id ?? "")}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sch-category">Category</Label>
              <CategoryPicker
                id="sch-category"
                value={form.categoryId}
                onChange={(id) => set("categoryId", id)}
                buckets={
                  form.kind === "income" ? ["income"] : ["need", "want", "save"]
                }
              />
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sch-amount">
              Amount{from ? ` (${from.currency})` : ""}
            </Label>
            <Input
              id="sch-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="0.00"
            />
          </div>
          {cross && (
            <div className="space-y-1.5">
              <Label htmlFor="sch-to-amount">
                About what arrives ({to.currency})
              </Label>
              <Input
                id="sch-to-amount"
                inputMode="decimal"
                value={form.toAmount}
                onChange={(e) => set("toAmount", e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between rounded-control border px-3 py-2.5">
          <Label htmlFor="sch-estimate" className="font-normal">
            The amount changes (hydro, a phone bill with usage)
          </Label>
          <Switch
            id="sch-estimate"
            checked={form.isEstimate}
            onCheckedChange={(v) => set("isEstimate", v)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sch-frequency">How often</Label>
            <Select
              value={form.frequency}
              onValueChange={(v) => set("frequency", v as Frequency)}
            >
              <SelectTrigger id="sch-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCY_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sch-start">
              {form.frequency === "once" ? "On" : "First on"}
            </Label>
            <Input
              id="sch-start"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>
          {form.frequency !== "once" && (
            <div className="space-y-1.5">
              <Label htmlFor="sch-end">Last on (optional)</Label>
              <Input
                id="sch-end"
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          )}
        </div>
        {form.frequency === "semimonthly" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sch-day1">Day</Label>
              <Input
                id="sch-day1"
                inputMode="numeric"
                value={form.dayOne}
                onChange={(e) => set("dayOne", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sch-day2">and day (31 = last)</Label>
              <Input
                id="sch-day2"
                inputMode="numeric"
                value={form.dayTwo}
                onChange={(e) => set("dayTwo", e.target.value)}
              />
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sch-payee">Payee (optional)</Label>
            <Input
              id="sch-payee"
              value={form.payee}
              onChange={(e) => set("payee", e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sch-notes">Notes</Label>
            <Textarea
              id="sch-notes"
              rows={1}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              maxLength={1000}
            />
          </div>
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
