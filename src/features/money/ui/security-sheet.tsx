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
import { FormSheet } from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import {
  ASSET_CLASSES,
  type AssetClass,
  REGIONS,
  type Region,
  type Security,
} from "../domain/invest";
import {
  useDeleteSecurityMutation,
  useSaveSecurityMutation,
} from "../data/money-api";
import { ALL_CURRENCIES } from "./labels";
import { useMoney } from "./money-context";

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  equity: "Stocks",
  fixed_income: "Bonds & fixed income",
  cash: "Cash & GICs",
  real_estate: "Real estate",
  commodity: "Commodities & gold",
  crypto: "Crypto",
  balanced: "Balanced (mixed)",
  other: "Other",
};

export const REGION_LABEL: Record<Region | "cash", string> = {
  canada: "Canada",
  us: "United States",
  india: "India",
  international: "International developed",
  emerging: "Emerging markets",
  global: "Global (all-in-one)",
  other: "Other",
  cash: "Cash",
};

const SYMBOL = /^[A-Z0-9][A-Z0-9.:^-]{0,19}$/;

/** A stock, ETF, fund or GIC the owner holds. */
export function SecuritySheet({
  security,
  open,
  onOpenChange,
  onSaved,
}: {
  security: Security | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const { settings, securities, trades } = useMoney();
  const [save, saving] = useSaveSecurityMutation();
  const [remove] = useDeleteSecurityMutation();
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(settings.baseCurrency);
  const [assetClass, setAssetClass] = useState<AssetClass>("equity");
  const [region, setRegion] = useState<Region>("global");
  const [problem, setProblem] = useState<string | null>(null);
  const traded = !!security && trades.some((t) => t.securityId === security.id);

  useEffect(() => {
    if (!open) return;
    setSymbol(security?.symbol ?? "");
    setName(security?.name ?? "");
    setCurrency(security?.currency ?? settings.baseCurrency);
    setAssetClass(security?.assetClass ?? "equity");
    setRegion(security?.region ?? "global");
    setProblem(null);
  }, [open, security, settings.baseCurrency]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const code = symbol.trim().toUpperCase();
    if (!SYMBOL.test(code))
      return setProblem(
        "The symbol is letters and digits, and may use . : - ^ (e.g. XEQT, VFV.TO, RELIANCE.NS).",
      );
    if (securities.some((x) => x.id !== security?.id && x.symbol === code))
      return setProblem(`${code} is already on the list.`);
    if (!name.trim()) return setProblem("Give it a name.");
    try {
      const id = await save({
        id: security?.id,
        symbol: code,
        name: name.trim().slice(0, 120),
        currency,
        assetClass,
        region,
        notes: security?.notes ?? null,
      }).unwrap();
      toast.success(`${code} saved`);
      onOpenChange(false);
      onSaved?.(id);
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  const destroy = async () => {
    if (!security) return;
    try {
      await remove(security.id).unwrap();
      toast.success(`${security.symbol} removed`);
      onOpenChange(false);
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={security ? `Edit ${security.symbol}` : "New security"}
      description="A stock, ETF, mutual fund or GIC. Its currency is the one it trades in."
      footer={
        <div className="flex gap-2">
          {security && !traded && (
            <Button
              type="button"
              variant="outline"
              aria-label="Delete security"
              onClick={destroy}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            form="money-security"
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
        id="money-security"
        onSubmit={submit}
        className="space-y-5"
        noValidate
      >
        <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sec-symbol">Symbol</Label>
            <Input
              id="sec-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              maxLength={20}
              autoCapitalize="characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sec-name">Name</Label>
            <Input
              id="sec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sec-currency">Trades in</Label>
          <Select
            value={currency}
            onValueChange={setCurrency}
            disabled={traded}
          >
            <SelectTrigger id="sec-currency">
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
          {traded && (
            <p className="text-xs text-muted-foreground">
              It has trades, so its currency is fixed.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sec-class">Asset class</Label>
            <Select
              value={assetClass}
              onValueChange={(v) => setAssetClass(v as AssetClass)}
            >
              <SelectTrigger id="sec-class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {ASSET_CLASS_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sec-region">Region</Label>
            <Select
              value={region}
              onValueChange={(v) => setRegion(v as Region)}
            >
              <SelectTrigger id="sec-region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REGION_LABEL[r]}
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
