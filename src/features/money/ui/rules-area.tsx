"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
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
import { FormSheet } from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import { categoryLabel } from "../domain/categories";
import { isUncategorised } from "../domain/ledger-query";
import type { Rule } from "../domain/model";
import { applyRules, isValidPattern, ruleMatches } from "../domain/rules";
import {
  useDeleteRuleMutation,
  useSaveRuleMutation,
  useUpdateTransactionMutation,
} from "../data/money-api";
import { useMoney } from "./money-context";
import { AccountSelect, CategoryPicker } from "./pickers";

const MATCH_LABEL: Record<Rule["match"], string> = {
  contains: "contains",
  starts_with: "starts with",
  equals: "is exactly",
  regex: "matches pattern",
};

/**
 * Rules that sort transactions for you: "anything containing
 * PRESTO is Transport › Transit pass". Applied on import, and on demand to
 * what is still uncategorised.
 */
export function RulesArea() {
  const { rules, categoryById, accountById, transactions } = useMoney();
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [remove] = useDeleteRuleMutation();
  const [update] = useUpdateTransactionMutation();
  const [applying, setApplying] = useState(false);

  // Only single-account spending/earning can be recategorised in place.
  const fixable = useMemo(
    () =>
      transactions
        .filter((t) => isUncategorised(t))
        .map((t) => {
          const accountId = t.postings[0]?.accountId ?? "";
          const hit = applyRules(rules, {
            description: t.description,
            payee: t.payee,
            accountId,
          });
          return hit?.categoryId ? { txn: t, hit } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [transactions, rules],
  );

  const applyAll = async () => {
    setApplying(true);
    let done = 0;
    try {
      for (const { txn, hit } of fixable.slice(0, 500)) {
        await update({
          id: txn.id,
          date: txn.date,
          kind: txn.kind,
          status: txn.status,
          description: txn.description,
          payee: txn.payee ?? hit.payee,
          notes: txn.notes,
          provider: txn.provider,
          marketRate: txn.marketRate,
          postings: txn.postings.map((p) =>
            p.categoryId ? p : { ...p, categoryId: hit.categoryId },
          ),
        }).unwrap();
        done += 1;
      }
      toast.success(`Categorised ${done} transaction${done === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(`Stopped after ${done}`, {
        description: getErrorMessage(error),
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          The highest priority matching rule wins, so a specific rule
          (&ldquo;AMAZON PRIME&rdquo; → Subscriptions) can sit above a general
          one (&ldquo;AMAZON&rdquo; → Shopping).
        </p>
        <div className="flex gap-2">
          {fixable.length > 0 && (
            <Button variant="outline" onClick={applyAll} disabled={applying}>
              {applying ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 size-4" />
              )}
              Categorise {fixable.length} uncategorised
            </Button>
          )}
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-2 size-4" /> Rule
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
          No rules yet. Start with the payments you see every month — rent,
          phone, transit, groceries.
        </p>
      ) : (
        <ul className="divide-y rounded-surface border bg-card text-sm">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center gap-3 px-4 py-2.5"
            >
              <span className="w-10 text-xs tabular-nums text-muted-foreground">
                {rule.priority}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={
                    rule.isActive ? "" : "text-muted-foreground line-through"
                  }
                >
                  {MATCH_LABEL[rule.match]}{" "}
                  <code className="rounded bg-secondary px-1">
                    {rule.pattern}
                  </code>
                </span>
                <span className="block text-xs text-muted-foreground">
                  →{" "}
                  {rule.categoryId
                    ? categoryLabel(rule.categoryId, categoryById)
                    : "no category change"}
                  {rule.payee ? ` · payee “${rule.payee}”` : ""}
                  {rule.accountId
                    ? ` · only ${accountById.get(rule.accountId)?.name ?? "one account"}`
                    : ""}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit rule ${rule.pattern}`}
                onClick={() => setEditing(rule)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete rule ${rule.pattern}`}
                onClick={() => remove(rule.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <RuleSheet rule={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function RuleSheet({
  rule,
  onClose,
}: {
  rule: Rule | "new" | null;
  onClose: () => void;
}) {
  const { transactions } = useMoney();
  const [save, saving] = useSaveRuleMutation();
  const existing = rule && rule !== "new" ? rule : null;
  const [draft, setDraft] = useState<Omit<Rule, "id">>({
    priority: 100,
    match: "contains",
    pattern: "",
    accountId: null,
    categoryId: null,
    payee: null,
    isActive: true,
  });
  const [opened, setOpened] = useState<Rule | "new" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (rule !== opened) {
    setOpened(rule);
    setDraft(
      existing
        ? { ...existing }
        : {
            priority: 100,
            match: "contains",
            pattern: "",
            accountId: null,
            categoryId: null,
            payee: null,
            isActive: true,
          },
    );
    setProblem(null);
  }

  const matches = useMemo(() => {
    if (!isValidPattern(draft)) return null;
    return transactions.filter(
      (t) =>
        (!draft.accountId ||
          t.postings.some((p) => p.accountId === draft.accountId)) &&
        (ruleMatches(draft, t.description) ||
          (t.payee ? ruleMatches(draft, t.payee) : false)),
    );
  }, [draft, transactions]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValidPattern(draft)) {
      setProblem(
        "Enter what to look for (a valid pattern, up to 200 characters).",
      );
      return;
    }
    if (!draft.categoryId && !draft.payee?.trim()) {
      setProblem("A rule has to set a category, a payee, or both.");
      return;
    }
    if (!Number.isInteger(draft.priority)) {
      setProblem("Priority is a whole number.");
      return;
    }
    try {
      await save({ ...draft, id: existing?.id }).unwrap();
      toast.success("Rule saved");
      onClose();
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  return (
    <FormSheet
      open={!!rule}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "Edit rule" : "New rule"}
      footer={
        <Button
          type="submit"
          form="money-rule"
          className="w-full"
          disabled={saving.isLoading}
        >
          Save rule
        </Button>
      }
    >
      <form id="money-rule" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rule-match">When the description</Label>
            <Select
              value={draft.match}
              onValueChange={(v) =>
                setDraft({ ...draft, match: v as Rule["match"] })
              }
            >
              <SelectTrigger id="rule-match">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MATCH_LABEL) as Rule["match"][]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MATCH_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-pattern">Text</Label>
            <Input
              id="rule-pattern"
              value={draft.pattern}
              onChange={(e) => setDraft({ ...draft, pattern: e.target.value })}
              maxLength={200}
              placeholder="e.g. PRESTO"
            />
          </div>
        </div>
        {matches && (
          <p className="text-sm text-muted-foreground">
            Matches {matches.length} of your transactions
            {matches.length > 0 && `, e.g. “${matches[0].description}”`}.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="rule-category">Set category to</Label>
          <CategoryPicker
            id="rule-category"
            value={draft.categoryId}
            onChange={(id) => setDraft({ ...draft, categoryId: id })}
            noneLabel="Leave the category alone"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-payee">Set payee to (optional)</Label>
          <Input
            id="rule-payee"
            value={draft.payee ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, payee: e.target.value || null })
            }
            maxLength={200}
            placeholder="e.g. Presto"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rule-account">Only for</Label>
            <AccountSelect
              id="rule-account"
              value={draft.accountId}
              onChange={(id) => setDraft({ ...draft, accountId: id })}
              allowNone
              noneLabel="Any account"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-priority">Priority</Label>
            <Input
              id="rule-priority"
              inputMode="numeric"
              value={String(draft.priority)}
              onChange={(e) =>
                setDraft({ ...draft, priority: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-control border px-3 py-2.5">
          <Label htmlFor="rule-active" className="font-normal">
            Active
          </Label>
          <Switch
            id="rule-active"
            checked={draft.isActive}
            onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
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
