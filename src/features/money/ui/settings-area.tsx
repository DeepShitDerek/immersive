"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { getErrorMessage } from "@/lib/utils";
import type { MoneySettings } from "../domain/model";
import { useSaveMoneySettingsMutation } from "../data/money-api";
import { CategoriesPanel } from "./categories-panel";
import { InstitutionsPanel } from "./institutions-panel";
import { ALL_CURRENCIES, PROVINCES } from "./labels";
import { useMoney } from "./money-context";
import { RatesPanel } from "./rates-panel";

const NONE = "__none__";

/**
 * The few facts the module needs about the owner's life, and the
 * reference data behind every screen: categories and exchange rates.
 */
export function SettingsArea() {
  return (
    <div className="space-y-10">
      <SettingsForm />
      <CategoriesPanel />
      <InstitutionsPanel />
      <RatesPanel />
    </div>
  );
}

function SettingsForm() {
  const { settings } = useMoney();
  const [save, saving] = useSaveMoneySettingsMutation();
  const [form, setForm] = useState({
    ...settings,
    birthYear: settings.birthYear ? String(settings.birthYear) : "",
    needsPct: String(settings.needsPct),
    wantsPct: String(settings.wantsPct),
    savePct: String(settings.savePct),
    emergencyMonths: String(settings.emergencyMonths),
  });
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    setForm({
      ...settings,
      birthYear: settings.birthYear ? String(settings.birthYear) : "",
      needsPct: String(settings.needsPct),
      wantsPct: String(settings.wantsPct),
      savePct: String(settings.savePct),
      emergencyMonths: String(settings.emergencyMonths),
    });
  }, [settings]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: string[] = [];
    const pct = (text: string, name: string) => {
      const n = Number(text);
      if (!Number.isFinite(n) || n < 0 || n > 100)
        found.push(`${name} is a percentage from 0 to 100.`);
      return n;
    };
    const needs = pct(form.needsPct, "Needs");
    const wants = pct(form.wantsPct, "Wants");
    const savings = pct(form.savePct, "Savings");
    if (Math.abs(needs + wants + savings - 100) > 1e-9)
      found.push("Needs, wants and savings have to add up to 100%.");
    const months = Number(form.emergencyMonths);
    if (!Number.isFinite(months) || months < 0 || months > 36)
      found.push("Emergency fund target is 0–36 months.");
    const birthYear = form.birthYear.trim() ? Number(form.birthYear) : null;
    if (
      birthYear !== null &&
      (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > 2100)
    )
      found.push("Birth year looks wrong.");
    if (form.baseCurrency === form.homeCurrency)
      found.push("Your main and home currencies should differ.");
    if (found.length) {
      setProblems(found);
      return;
    }
    const next: MoneySettings = {
      baseCurrency: form.baseCurrency,
      homeCurrency: form.homeCurrency,
      province: form.province,
      birthYear,
      residentSince: form.residentSince || null,
      needsPct: needs,
      wantsPct: wants,
      savePct: savings,
      emergencyMonths: months,
    };
    try {
      await save(next).unwrap();
      setProblems([]);
      toast.success("Settings saved");
    } catch (error) {
      setProblems([getErrorMessage(error)]);
    }
  };

  const set = (key: keyof typeof form, value: string | null) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <section aria-labelledby="settings-heading" className="space-y-4">
      <div>
        <h2
          id="settings-heading"
          className="font-heading text-lg font-semibold"
        >
          About you
        </h2>
        <p className="text-sm text-muted-foreground">
          Used for totals, contribution room and the tax-year view. Nothing here
          leaves your database.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="grid gap-4 rounded-surface border bg-card p-5 sm:grid-cols-2"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="set-base">Main currency</Label>
          <Select
            value={form.baseCurrency}
            onValueChange={(v) => set("baseCurrency", v)}
          >
            <SelectTrigger id="set-base">
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
          <p className="text-xs text-muted-foreground">
            Every total is reported in this.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="set-home">Home currency</Label>
          <Select
            value={form.homeCurrency}
            onValueChange={(v) => set("homeCurrency", v)}
          >
            <SelectTrigger id="set-home">
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
          <p className="text-xs text-muted-foreground">
            Where family and money back home are.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="set-province">Province</Label>
          <Select
            value={form.province ?? NONE}
            onValueChange={(v) => set("province", v === NONE ? null : v)}
          >
            <SelectTrigger id="set-province">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {PROVINCES.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-birth">Birth year</Label>
            <Input
              id="set-birth"
              inputMode="numeric"
              value={form.birthYear}
              onChange={(e) => set("birthYear", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-resident">Resident since</Label>
            <Input
              id="set-resident"
              type="date"
              value={form.residentSince ?? ""}
              onChange={(e) => set("residentSince", e.target.value)}
            />
          </div>
        </div>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">Spending plan</legend>
          <p className="text-xs text-muted-foreground">
            The share of take-home pay for needs, wants and saving. 50/30/20 is
            a common start; rent in a Canadian city often pushes needs higher.
          </p>
          <div className="grid grid-cols-4 gap-3">
            {(
              [
                ["needsPct", "Needs %"],
                ["wantsPct", "Wants %"],
                ["savePct", "Savings %"],
                ["emergencyMonths", "Emergency months"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`set-${key}`} className="text-xs">
                  {label}
                </Label>
                <Input
                  id={`set-${key}`}
                  inputMode="decimal"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </fieldset>
        {problems.length > 0 && (
          <ul
            role="alert"
            className="space-y-1 rounded-control bg-destructive/10 px-3 py-2.5 text-sm text-destructive sm:col-span-2"
          >
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving.isLoading}>
            {saving.isLoading && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            {settings.saved ? "Save" : "Save and start"}
          </Button>
        </div>
      </form>
    </section>
  );
}
