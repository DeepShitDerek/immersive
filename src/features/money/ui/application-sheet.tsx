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
import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
  CREDIT_PRODUCTS,
  type CreditProduct,
  DEFAULT_DOCUMENTS,
} from "../domain/applications";
import { isIsoDate } from "../domain/dates";
import { money, MoneyError, parseAmount, toInputString } from "../domain/money";
import {
  useDeleteApplicationMutation,
  useSaveApplicationMutation,
} from "../data/money-api";
import { ALL_CURRENCIES } from "./labels";
import { useMoney } from "./money-context";

export const PRODUCT_LABEL: Record<CreditProduct, string> = {
  mortgage: "Mortgage",
  auto_loan: "Car loan",
  personal_loan: "Personal loan",
  line_of_credit: "Line of credit",
  credit_card: "Credit card",
  student_loan: "Student loan",
  other: "Other",
};

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  planning: "Planning",
  submitted: "Submitted",
  conditional: "Conditionally approved",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
  funded: "Funded",
};

const blank = (currency: string) => ({
  lender: "",
  product: "mortgage" as CreditProduct,
  status: "planning" as ApplicationStatus,
  amount: "",
  currency,
  rate: "",
  termYears: "",
  amortYears: "",
  price: "",
  down: "",
  tax: "",
  heating: "",
  condo: "",
  submittedOn: "",
  decidedOn: "",
  hardInquiryOn: "",
  notes: "",
});
type Form = ReturnType<typeof blank>;

const years = (months: number | null) =>
  months ? String(+(months / 12).toFixed(2)) : "";
const amountText = (minor: number | null, currency: string) =>
  minor == null ? "" : toInputString(money(minor, currency));

/** One credit application: who, what, where it stands. */
export function ApplicationSheet({
  application,
  open,
  onOpenChange,
  onSaved,
}: {
  application: Application | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const { settings } = useMoney();
  const [save, saving] = useSaveApplicationMutation();
  const [remove] = useDeleteApplicationMutation();
  const [form, setForm] = useState<Form>(() => blank(settings.baseCurrency));
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const a = application;
    setForm(
      a
        ? {
            lender: a.lender,
            product: a.product,
            status: a.status,
            amount: amountText(a.amountMinor, a.currency),
            currency: a.currency,
            rate: a.rate == null ? "" : String(a.rate),
            termYears: years(a.termMonths),
            amortYears: years(a.amortizationMonths),
            price: amountText(a.purchasePriceMinor, a.currency),
            down: amountText(a.downPaymentMinor, a.currency),
            tax: amountText(a.propertyTaxMonthlyMinor, a.currency),
            heating: amountText(a.heatingMonthlyMinor, a.currency),
            condo: amountText(a.condoFeesMonthlyMinor, a.currency),
            submittedOn: a.submittedOn ?? "",
            decidedOn: a.decidedOn ?? "",
            hardInquiryOn: a.hardInquiryOn ?? "",
            notes: a.notes ?? "",
          }
        : blank(settings.baseCurrency),
    );
    setProblem(null);
  }, [open, application, settings.baseCurrency]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const mortgage = form.product === "mortgage";

  const build = (): Omit<Application, "id" | "documents"> | string => {
    if (!form.lender.trim()) return "Name the lender.";
    const amount = (
      text: string,
      label: string,
      allowZero: boolean,
    ): number | null => {
      if (!text.trim()) return null;
      const minor = parseAmount(text, form.currency).minor;
      if (minor < 0 || (!allowZero && minor === 0))
        throw new MoneyError(`${label} has to be more than zero.`);
      return minor;
    };
    const monthsOf = (text: string, label: string): number | null => {
      if (!text.trim()) return null;
      const m = Math.round(Number(text) * 12);
      if (!Number.isFinite(m) || m < 1 || m > 600)
        throw new MoneyError(`${label} is between 1 month and 50 years.`);
      return m;
    };
    try {
      const rate = form.rate.trim() ? Number(form.rate) : null;
      if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100))
        return "The rate is a percentage from 0 to 100.";
      const price = mortgage
        ? amount(form.price, "The purchase price", false)
        : null;
      const down = mortgage
        ? amount(form.down, "The down payment", true)
        : null;
      if (price !== null && down !== null && down > price)
        return "The down payment can't be more than the price.";
      for (const [value, label] of [
        [form.submittedOn, "submitted"],
        [form.decidedOn, "decided"],
        [form.hardInquiryOn, "credit check"],
      ] as const) {
        if (value && !isIsoDate(value))
          return `The ${label} date isn't a date.`;
      }
      if (
        form.submittedOn &&
        form.decidedOn &&
        form.decidedOn < form.submittedOn
      )
        return "The decision can't come before the application.";
      return {
        lender: form.lender.trim(),
        product: form.product,
        status: form.status,
        amountMinor: amount(form.amount, "The amount", false),
        currency: form.currency,
        rate: rate === null ? null : Math.round(rate * 1000) / 1000,
        termMonths: monthsOf(form.termYears, "The term"),
        amortizationMonths: monthsOf(form.amortYears, "Amortization"),
        purchasePriceMinor: price,
        downPaymentMinor: down,
        propertyTaxMonthlyMinor: mortgage
          ? amount(form.tax, "Property tax", true)
          : null,
        heatingMonthlyMinor: mortgage
          ? amount(form.heating, "Heating", true)
          : null,
        condoFeesMonthlyMinor: mortgage
          ? amount(form.condo, "Condo fees", true)
          : null,
        submittedOn: form.submittedOn || null,
        decidedOn: form.decidedOn || null,
        hardInquiryOn: form.hardInquiryOn || null,
        notes: form.notes.trim() || null,
      };
    } catch (error) {
      return error instanceof MoneyError ? error.message : "Unreadable amount.";
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const app = build();
    if (typeof app === "string") return setProblem(app);
    try {
      const id = await save({
        ...app,
        id: application?.id,
        starterDocuments: DEFAULT_DOCUMENTS[app.product],
      }).unwrap();
      toast.success(
        application
          ? "Application saved"
          : "Application added, with a starter checklist",
      );
      onOpenChange(false);
      onSaved?.(id);
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  const field = (
    key: keyof Form,
    label: string,
    props: { type?: string; placeholder?: string; decimal?: boolean } = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`app-${key}`}>{label}</Label>
      <Input
        id={`app-${key}`}
        type={props.type}
        inputMode={props.decimal ? "decimal" : undefined}
        placeholder={props.placeholder}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        application
          ? `${application.lender} — ${PRODUCT_LABEL[application.product]}`
          : "New application"
      }
      description={
        application
          ? undefined
          : "A checklist of the documents lenders usually ask for comes with it."
      }
      footer={
        <div className="flex gap-2">
          {application && (
            <Button
              type="button"
              variant="outline"
              aria-label="Delete application"
              onClick={() =>
                remove(application.id).then(() => onOpenChange(false))
              }
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            form="money-application"
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
        id="money-application"
        onSubmit={submit}
        className="space-y-5"
        noValidate
      >
        <div className="grid grid-cols-2 gap-3">
          {field("lender", "Lender")}
          <div className="space-y-1.5">
            <Label htmlFor="app-product">Product</Label>
            <Select
              value={form.product}
              onValueChange={(v) => set("product", v as CreditProduct)}
              disabled={!!application}
            >
              <SelectTrigger id="app-product">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_PRODUCTS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRODUCT_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-status">Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => set("status", v as ApplicationStatus)}
          >
            <SelectTrigger id="app-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPLICATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem_5rem] gap-3">
          {field("amount", mortgage ? "Mortgage amount" : "Amount", {
            decimal: true,
            placeholder: mortgage ? "from price" : "",
          })}
          <div className="space-y-1.5">
            <Label htmlFor="app-currency">Currency</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => set("currency", v)}
            >
              <SelectTrigger id="app-currency">
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
          {field("rate", "Rate %", { decimal: true })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("termYears", "Term (years)", { decimal: true })}
          {field("amortYears", "Amortization (years)", {
            decimal: true,
            placeholder: mortgage ? "25" : "",
          })}
        </div>
        {mortgage && (
          <fieldset className="space-y-3 rounded-control border p-3">
            <legend className="px-1 text-sm font-medium">The home</legend>
            <div className="grid grid-cols-2 gap-3">
              {field("price", "Purchase price", { decimal: true })}
              {field("down", "Down payment", { decimal: true })}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {field("tax", "Property tax / mo", { decimal: true })}
              {field("heating", "Heating / mo", {
                decimal: true,
                placeholder: "lenders assume ~100",
              })}
              {field("condo", "Condo fees / mo", { decimal: true })}
            </div>
          </fieldset>
        )}
        <div className="grid grid-cols-3 gap-3">
          {field("submittedOn", "Submitted", { type: "date" })}
          {field("decidedOn", "Decided", { type: "date" })}
          {field("hardInquiryOn", "Credit pulled", { type: "date" })}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-notes">Notes</Label>
          <Textarea
            id="app-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            maxLength={2000}
          />
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
