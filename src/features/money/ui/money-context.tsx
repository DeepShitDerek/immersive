"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { today as todayIn } from "../domain/dates";
import type { Budget } from "../domain/budget";
import { buildRateTable, type RateTable } from "../domain/fx";
import type { Goal } from "../domain/goals";
import type { Application } from "../domain/applications";
import {
  buildPriceBook,
  type Portfolio,
  portfolio,
  type Price,
  type PriceBook,
  type Security,
  type Trade,
} from "../domain/invest";
import type { CreditScore, IncomeSource } from "../domain/lender-report";
import type { Loan, RoomRecord } from "../data/rows";
import type { Schedule } from "../domain/schedule";
import { type Balance, balances, type Transaction } from "../domain/ledger";
import type {
  Category,
  Institution,
  MoneySettings,
  Reconciliation,
  Rule,
} from "../domain/model";
import type { AccountRecord } from "../data/rows";
import {
  useGetAccountsQuery,
  useGetBudgetsQuery,
  useGetCategoriesQuery,
  useGetGoalsQuery,
  useGetApplicationsQuery,
  useGetPricesQuery,
  useGetRoomQuery,
  useGetSecuritiesQuery,
  useGetTradesQuery,
  useGetCreditScoresQuery,
  useGetIncomeSourcesQuery,
  useGetLoansQuery,
  useGetSchedulesQuery,
  useGetSkipsQuery,
  useGetInstitutionsQuery,
  useGetMoneySettingsQuery,
  useGetRatesQuery,
  useGetReconciliationsQuery,
  useGetRulesQuery,
  useGetTransactionsQuery,
} from "../data/money-api";
import type { RateRow } from "../domain/fx";

/**
 * Everything the money screens read, loaded once and derived once.
 *
 * Each area used to fetch and re-derive on its own; with one ledger and one
 * rate table in context, two screens can never disagree about a balance.
 */

export interface MoneyData {
  settings: MoneySettings & { saved: boolean };
  accounts: AccountRecord[];
  /** Not archived, in display order. */
  openAccounts: AccountRecord[];
  accountById: ReadonlyMap<string, AccountRecord>;
  institutions: Institution[];
  categories: Category[];
  categoryById: ReadonlyMap<string, Category>;
  /** Newest first. */
  transactions: Transaction[];
  rates: RateRow[];
  rateTable: RateTable;
  rules: Rule[];
  reconciliations: Reconciliation[];
  schedules: Schedule[];
  /** "scheduleId|dueDate" of every skipped occurrence. */
  skips: ReadonlySet<string>;
  budgets: Budget[];
  goals: Goal[];
  loans: Loan[];
  /** Loan terms by the account they belong to. */
  loanByAccount: ReadonlyMap<string, Loan>;
  incomeSources: IncomeSource[];
  creditScores: CreditScore[];
  applications: Application[];
  securities: Security[];
  securityById: ReadonlyMap<string, Security>;
  prices: Price[];
  priceBook: PriceBook;
  trades: Trade[];
  room: RoomRecord[];
  /** Every investment account's cash, holdings and value today. */
  portfolioByAccount: ReadonlyMap<string, Portfolio>;
  /** Ledger transactions written by a trade — edited through the trade, never directly. */
  tradeTransactionIds: ReadonlySet<string>;
  today: string;
  /** Balances as of today, including pending. */
  balanceByAccount: ReadonlyMap<string, Balance>;
  /**
   * What each account is worth today: the ledger balance, except that an
   * investment account counts its holdings at market value (at cost when
   * unpriced). Use for net worth; use `balanceByAccount` for the ledger.
   */
  worthByAccount: ReadonlyMap<string, Balance>;
}

interface MoneyState {
  data: MoneyData | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

const MoneyContext = createContext<MoneyState | null>(null);

export function MoneyProvider({ children }: { children: ReactNode }) {
  const settings = useGetMoneySettingsQuery();
  const accounts = useGetAccountsQuery();
  const institutions = useGetInstitutionsQuery();
  const categories = useGetCategoriesQuery();
  const transactions = useGetTransactionsQuery();
  const rates = useGetRatesQuery();
  const rules = useGetRulesQuery();
  const reconciliations = useGetReconciliationsQuery();
  const schedules = useGetSchedulesQuery();
  const skips = useGetSkipsQuery();
  const budgets = useGetBudgetsQuery();
  const goals = useGetGoalsQuery();
  const loans = useGetLoansQuery();
  const incomeSources = useGetIncomeSourcesQuery();
  const creditScores = useGetCreditScoresQuery();
  const applications = useGetApplicationsQuery();
  const securities = useGetSecuritiesQuery();
  const prices = useGetPricesQuery();
  const trades = useGetTradesQuery();
  const room = useGetRoomQuery();
  const queries = [
    settings,
    accounts,
    institutions,
    categories,
    transactions,
    rates,
    rules,
    reconciliations,
    schedules,
    skips,
    budgets,
    goals,
    loans,
    incomeSources,
    creditScores,
    applications,
    securities,
    prices,
    trades,
    room,
  ];

  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error;

  const data = useMemo<MoneyData | null>(() => {
    if (
      !settings.data ||
      !accounts.data ||
      !institutions.data ||
      !categories.data ||
      !transactions.data ||
      !rates.data ||
      !rules.data ||
      !reconciliations.data ||
      !schedules.data ||
      !skips.data ||
      !budgets.data ||
      !goals.data ||
      !loans.data ||
      !incomeSources.data ||
      !creditScores.data ||
      !applications.data ||
      !securities.data ||
      !prices.data ||
      !trades.data ||
      !room.data
    ) {
      return null;
    }
    const today = todayIn();
    const openAccounts = accounts.data.filter((a) => !a.archivedAt);
    const balanceByAccount = balances(accounts.data, transactions.data, today);
    const securityById = new Map(securities.data.map((x) => [x.id, x]));
    const priceBook = buildPriceBook(prices.data);
    const portfolioByAccount = new Map<string, Portfolio>();
    const worthByAccount = new Map(balanceByAccount);
    for (const account of accounts.data) {
      if (account.kind !== "investment") continue;
      const balance = balanceByAccount.get(account.id);
      const pf = portfolio({
        accountId: account.id,
        currency: account.currency,
        ledgerBalanceMinor: balance?.balanceMinor ?? 0,
        trades: trades.data,
        securities: securityById,
        prices: priceBook,
        on: today,
      });
      portfolioByAccount.set(account.id, pf);
      if (balance)
        worthByAccount.set(account.id, {
          ...balance,
          balanceMinor: pf.valueMinor,
        });
    }
    return {
      settings: settings.data,
      accounts: accounts.data,
      openAccounts,
      accountById: new Map(accounts.data.map((a) => [a.id, a])),
      institutions: institutions.data,
      categories: categories.data,
      categoryById: new Map(categories.data.map((c) => [c.id, c])),
      transactions: transactions.data,
      rates: rates.data,
      rateTable: buildRateTable(rates.data),
      rules: rules.data,
      reconciliations: reconciliations.data,
      schedules: schedules.data,
      skips: new Set(skips.data),
      budgets: budgets.data,
      goals: goals.data,
      loans: loans.data,
      loanByAccount: new Map(loans.data.map((l) => [l.accountId, l])),
      incomeSources: incomeSources.data,
      creditScores: creditScores.data,
      applications: applications.data,
      securities: securities.data,
      securityById,
      prices: prices.data,
      priceBook,
      trades: trades.data,
      room: room.data,
      portfolioByAccount,
      tradeTransactionIds: new Set(
        trades.data
          .map((t) => t.transactionId)
          .filter((id): id is string => !!id),
      ),
      today,
      balanceByAccount,
      worthByAccount,
    };
  }, [
    settings.data,
    accounts.data,
    institutions.data,
    categories.data,
    transactions.data,
    rates.data,
    rules.data,
    reconciliations.data,
    schedules.data,
    skips.data,
    budgets.data,
    goals.data,
    loans.data,
    incomeSources.data,
    creditScores.data,
    applications.data,
    securities.data,
    prices.data,
    trades.data,
    room.data,
  ]);

  const value = useMemo<MoneyState>(
    () => ({
      data,
      isLoading,
      error,
      refetch: () => queries.forEach((q) => q.refetch()),
    }),
    // `queries` is rebuilt every render; its refetch functions are stable.
    [data, isLoading, error],
  );

  return (
    <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>
  );
}

export function useMoneyState(): MoneyState {
  const state = useContext(MoneyContext);
  if (!state)
    throw new Error("useMoneyState must be used inside <MoneyProvider>");
  return state;
}

/** The loaded data; only for components rendered after loading. */
export function useMoney(): MoneyData {
  const { data } = useMoneyState();
  if (!data) throw new Error("useMoney called before the money data loaded");
  return data;
}
