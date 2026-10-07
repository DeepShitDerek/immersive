"use client";

import { useCreateIntent } from "@/features/admin-shell/create-intent";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LoadingState,
  ManagerWrapper,
  ModuleTabs,
  PageHeader,
  type ModuleTab,
} from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import { AccountsArea } from "./accounts-area";
import { BorrowingArea } from "./borrowing-area";
import { ImportArea } from "./import-area";
import { InvestArea } from "./invest-area";
import { MoneyProvider, useMoneyState } from "./money-context";
import { type AreaId, OverviewArea } from "./overview-area";
import { PlanArea } from "./plan-area";
import { ReportsArea } from "./reports-area";
import { RulesArea } from "./rules-area";
import { RateSync } from "./rate-sync";
import { SettingsArea } from "./settings-area";
import { TransactionSheet } from "./transaction-sheet";
import { TransactionsArea } from "./transactions-area";

/**
 * The ten areas, in three groups by how often they are opened: the everyday
 * register, the periodic reviews, and setup.
 */
const AREAS: (ModuleTab<AreaId> & { question: string })[] = [
  {
    id: "overview",
    label: "Overview",
    group: 0,
    question: "Where do I stand?",
  },
  {
    id: "accounts",
    label: "Accounts",
    group: 0,
    question: "What does each account hold?",
  },
  {
    id: "transactions",
    label: "Transactions",
    group: 0,
    question: "Where did the money go?",
  },
  {
    id: "plan",
    label: "Plan",
    group: 0,
    question: "What's due, what's budgeted, what you're saving for.",
  },
  {
    id: "investing",
    label: "Investing",
    group: 1,
    question: "What your investments are worth, and the room left to add.",
  },
  {
    id: "borrowing",
    label: "Borrowing",
    group: 1,
    question: "Loans, credit, and applying for more.",
  },
  {
    id: "reports",
    label: "Reports",
    group: 1,
    question:
      "How the months went, net worth over time, the cost of sending money, the tax year.",
  },
  {
    id: "import",
    label: "Import",
    group: 2,
    question: "Bring in a bank statement.",
  },
  {
    id: "rules",
    label: "Rules",
    group: 2,
    question: "Sort transactions automatically.",
  },
  {
    id: "settings",
    label: "Settings",
    group: 2,
    question: "Currencies, categories and rates.",
  },
];

/** Where the header's "Transaction" is the screen's one primary action. */
const TRANSACTION_AREAS: readonly AreaId[] = ["overview", "transactions"];

const isArea = (value: string | null): value is AreaId =>
  AREAS.some((a) => a.id === value);

/**
 * /admin/finance — the money module. The area and the account the
 * register is focused on live in the URL, so Back works and a view can be
 * reloaded or bookmarked.
 */
export default function MoneyPage({
  basePath = "/admin/finance/",
  syncRates = true,
}: {
  basePath?: string;
  /** Off where there is no network to ask: the offline harness. */
  syncRates?: boolean;
}) {
  return (
    <MoneyProvider>
      <MoneyShell basePath={basePath} syncRates={syncRates} />
    </MoneyProvider>
  );
}

function MoneyShell({
  basePath,
  syncRates,
}: {
  basePath: string;
  syncRates: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { data, isLoading, error, refetch } = useMoneyState();
  const [adding, setAdding] = useState(false);
  useCreateIntent(
    "transaction",
    () => setAdding(true),
    !!data && data.openAccounts.length > 0,
  );

  const area: AreaId = isArea(params?.get("area") ?? null)
    ? (params!.get("area") as AreaId)
    : "overview";
  const accountId = params?.get("account") ?? null;
  const go = (next: AreaId, account: string | null = null) => {
    const query = new URLSearchParams();
    if (next !== "overview") query.set("area", next);
    if (account) query.set("account", account);
    const suffix = query.toString();
    router.push(`${basePath}${suffix ? `?${suffix}` : ""}`, { scroll: false });
  };
  const current = AREAS.find((a) => a.id === area)!;

  return (
    <ManagerWrapper>
      {/*
        One primary action per screen (G7). The header offers a transaction
        where recording one is the point of the screen; other areas carry
        their own single create action (account, schedule, rule) in place.
      */}
      <PageHeader
        title="Money"
        description={current.question}
        actions={
          data &&
          data.openAccounts.length > 0 &&
          TRANSACTION_AREAS.includes(area) ? (
            <Button onClick={() => setAdding(true)}>
              <Plus className="mr-2 size-4" aria-hidden /> Transaction
            </Button>
          ) : undefined
        }
      />

      <ModuleTabs
        label="Money sections"
        tabs={AREAS}
        current={area}
        onSelect={(next) => go(next)}
      />

      {error ? (
        <div
          role="alert"
          className="rounded-surface border border-destructive/40 bg-destructive/5 p-5 text-sm"
        >
          <p className="font-medium text-destructive">
            The money data couldn&apos;t be loaded.
          </p>
          <p className="mt-1 text-muted-foreground">{getErrorMessage(error)}</p>
          <p className="mt-1 text-muted-foreground">
            If this is the first time, the database may not have the money
            tables yet — re-run db/schema.sql.
          </p>
          <Button variant="outline" className="mt-3" onClick={refetch}>
            Try again
          </Button>
        </div>
      ) : isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
          {area === "overview" && <OverviewArea onGo={(next) => go(next)} />}
          {area === "accounts" && (
            <AccountsArea onOpenRegister={(id) => go("transactions", id)} />
          )}
          {area === "transactions" && (
            <TransactionsArea
              accountId={accountId}
              onAccountChange={(id) => go("transactions", id)}
            />
          )}
          {area === "plan" && <PlanArea />}
          {area === "investing" && <InvestArea />}
          {area === "borrowing" && <BorrowingArea />}
          {area === "reports" && <ReportsArea />}
          {area === "import" && <ImportArea />}
          {area === "rules" && <RulesArea />}
          {area === "settings" && <SettingsArea />}
          {syncRates && <RateSync />}
          <TransactionSheet
            open={adding}
            onOpenChange={setAdding}
            defaultAccountId={accountId ?? undefined}
          />
        </>
      )}
    </ManagerWrapper>
  );
}
