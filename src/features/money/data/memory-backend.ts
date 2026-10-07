import { LEDGER_TRADE_KINDS, validateTrade } from "../domain/invest";
import { validateAccount, validateTransaction } from "../domain/ledger";
import type {
  MoneyBackend,
  InstitutionRow,
  ReconciliationRow,
  Result,
  RpcPosting,
  RpcTransaction,
  RuleRow,
} from "./backend";
import {
  accountFromRow,
  type AccountRow,
  type BudgetRow,
  type CategoryRow,
  type ApplicationRow,
  type CreditScoreRow,
  type GoalRow,
  type IncomeSourceRow,
  type LoanRow,
  type PriceRow,
  type RoomRow,
  type SecurityRow,
  type TradeRow,
  tradeFromRow,
  type PostingRow,
  type RateDbRow,
  type ScheduleRow,
  type SettingsRow,
  type TransactionRow,
  toMinor,
} from "./rows";

/**
 * An in-memory money backend for the dev harness — never used by
 * the app. It keeps the database's rules through the same domain checks the
 * forms use, and persists to localStorage so a reload keeps the ledger.
 *
 * It is a stand-in for exercising the screens, not a second implementation
 * of the schema: db/test/20-money.sql is what proves the real rules.
 */

interface State {
  settings: SettingsRow | null;
  institutions: InstitutionRow[];
  accounts: AccountRow[];
  categories: CategoryRow[];
  transactions: (Omit<TransactionRow, "money_posting"> & {
    money_posting: PostingRow[];
    created: number;
  })[];
  rates: RateDbRow[];
  rules: (RuleRow & { created: number })[];
  reconciliations: ReconciliationRow[];
  schedules: ScheduleRow[];
  skips: { schedule_id: string; due_date: string }[];
  budgets: BudgetRow[];
  goals: GoalRow[];
  loans: LoanRow[];
  incomeSources: IncomeSourceRow[];
  creditScores: CreditScoreRow[];
  applications: ApplicationRow[];
  securities: SecurityRow[];
  prices: PriceRow[];
  trades: TradeRow[];
  room: RoomRow[];
}

const empty = (): State => ({
  settings: null,
  institutions: [],
  accounts: [],
  categories: [],
  transactions: [],
  rates: [],
  rules: [],
  reconciliations: [],
  schedules: [],
  skips: [],
  budgets: [],
  goals: [],
  loans: [],
  incomeSources: [],
  creditScores: [],
  applications: [],
  securities: [],
  prices: [],
  trades: [],
  room: [],
});

const fail = (message: string): Result<never> => ({ error: { message } });
const ok = <T>(data: T): Result<T> => ({ data });
const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

export function createMemoryBackend(
  storageKey: string | null = "money-harness",
): MoneyBackend & { reset(): void } {
  let state: State = empty();
  let clock = 0;
  if (storageKey && typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) state = { ...empty(), ...(JSON.parse(saved) as State) };
    } catch {
      state = empty();
    }
  }
  const persist = () => {
    if (!storageKey || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Storage full or blocked: the harness keeps working for this session.
    }
  };
  /** Latency like a network, so loading states are exercised. */
  const settle = <T>(value: T) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(value), 30));
  const commit = <T>(value: T) => {
    persist();
    return settle(value);
  };

  const base = () => state.settings?.base_currency ?? "CAD";
  const accountMap = () =>
    new Map(state.accounts.map((a) => [a.id, accountFromRow(a)]));
  const hasHistory = (accountId: string) =>
    state.transactions.some((t) =>
      t.money_posting.some((p) => p.account_id === accountId),
    );

  /** Build a transaction row from RPC input, or explain why not. */
  const build = (
    txnId: string,
    txn: RpcTransaction,
    postings: RpcPosting[],
    existing?: State["transactions"][number],
  ): Result<State["transactions"][number]> => {
    const accounts = accountMap();
    const rows: PostingRow[] = [];
    for (const p of postings) {
      const account = accounts.get(String(p.account_id));
      if (!account) return fail("Account not found");
      const categoryId = (p.category_id as string | null) ?? null;
      if (categoryId && !state.categories.some((c) => c.id === categoryId))
        return fail("Category not found");
      const amount = Number(p.amount_minor);
      const priced = account.currency === base();
      rows.push({
        account_id: account.id,
        category_id: categoryId,
        amount_minor: amount,
        memo: (p.memo as string | null) ?? null,
        fx_rate: priced ? 1 : ((p.fx_rate as string | null) ?? null),
        base_amount_minor: priced
          ? amount
          : ((p.base_amount_minor as number | null) ?? null),
      });
    }
    const row = {
      id: txnId,
      date: String(txn.date),
      kind: txn.kind as TransactionRow["kind"],
      status: ((txn.status as string) || "cleared") as TransactionRow["status"],
      description: String(txn.description ?? ""),
      payee: (txn.payee as string | null) ?? null,
      notes: (txn.notes as string | null) ?? null,
      provider: (txn.provider as string | null) ?? null,
      market_rate: (txn.market_rate as string | null) ?? null,
      schedule_id:
        existing?.schedule_id ?? (txn.schedule_id as string | null) ?? null,
      occurrence_date:
        existing?.occurrence_date ??
        (txn.occurrence_date as string | null) ??
        null,
      import_hash:
        existing?.import_hash ?? (txn.import_hash as string | null) ?? null,
      money_posting: rows,
      created: existing?.created ?? (clock += 1),
    };
    const problems = validateTransaction(
      {
        date: row.date,
        kind: row.kind,
        description: row.description,
        marketRate: row.market_rate == null ? null : Number(row.market_rate),
        postings: rows.map((r) => ({
          accountId: r.account_id,
          categoryId: r.category_id,
          amountMinor: toMinor(r.amount_minor),
          fxRate: r.fx_rate == null ? null : Number(r.fx_rate),
          baseAmountMinor:
            r.base_amount_minor == null ? null : toMinor(r.base_amount_minor),
        })),
      },
      accounts,
    );
    return problems.length ? fail(problems[0]) : ok(row);
  };

  const sortedTransactions = () =>
    [...state.transactions].sort(
      (a, b) => b.date.localeCompare(a.date) || b.created - a.created,
    );

  return {
    reset() {
      state = empty();
      persist();
    },

    getSettings: () => settle(ok(state.settings)),
    saveSettings: async (row) => {
      if (
        Number(row.needs_pct) + Number(row.wants_pct) + Number(row.save_pct) !==
        100
      )
        return fail("money_settings_split_is_whole");
      if (row.base_currency === row.home_currency)
        return fail("money_settings_two_currencies");
      state.settings = { ...row };
      return commit(ok(null));
    },

    listInstitutions: () =>
      settle(
        ok(
          [...state.institutions].sort((a, b) => a.name.localeCompare(b.name)),
        ),
      ),
    saveInstitution: async (instId, row) => {
      if (
        state.institutions.some(
          (i) =>
            i.id !== instId && i.name.toLowerCase() === row.name.toLowerCase(),
        )
      ) {
        return fail("duplicate key value violates unique constraint");
      }
      const saved = { id: instId ?? id(), ...row };
      state.institutions = [
        ...state.institutions.filter((i) => i.id !== saved.id),
        saved,
      ];
      return commit(ok(saved));
    },
    deleteInstitution: async (instId) => {
      state.institutions = state.institutions.filter((i) => i.id !== instId);
      state.accounts = state.accounts.map((a) =>
        a.institution_id === instId ? { ...a, institution_id: null } : a,
      );
      return commit(ok(null));
    },

    listAccounts: () =>
      settle(
        ok(
          [...state.accounts].sort(
            (a, b) =>
              a.sort_order - b.sort_order || a.name.localeCompare(b.name),
          ),
        ),
      ),
    saveAccount: async (accountId, row) => {
      const record = accountFromRow({
        ...row,
        id: accountId ?? "new",
        archived_at: null,
      } as AccountRow);
      const problems = validateAccount(record);
      if (problems.length) return fail(problems[0]);
      const before = state.accounts.find((a) => a.id === accountId);
      if (
        before &&
        state.trades.some((t) => t.account_id === before.id) &&
        (row.kind !== "investment" || row.currency !== before.currency)
      ) {
        return fail(
          `This account has trades; it stays an investment account in ${before.currency}`,
        );
      }
      if (before && hasHistory(before.id)) {
        if (before.currency !== row.currency)
          return fail("An account with transactions cannot change currency");
        const earliest = state.transactions
          .filter((t) =>
            t.money_posting.some((p) => p.account_id === before.id),
          )
          .reduce((min, t) => (t.date < min ? t.date : min), "9999-12-31");
        if (row.opening_date > earliest)
          return fail(
            `The account has transactions before ${row.opening_date}`,
          );
      }
      const saved: AccountRow = {
        ...row,
        id: accountId ?? id(),
        archived_at: before?.archived_at ?? null,
      } as AccountRow;
      state.accounts = [
        ...state.accounts.filter((a) => a.id !== saved.id),
        saved,
      ];
      return commit(ok(saved));
    },
    setAccountArchived: async (accountId, archivedAt) => {
      state.accounts = state.accounts.map((a) =>
        a.id === accountId ? { ...a, archived_at: archivedAt } : a,
      );
      return commit(ok(null));
    },
    deleteAccount: async (accountId) => {
      if (hasHistory(accountId))
        return fail(
          'update or delete on table "money_account" violates foreign key constraint',
        );
      state.accounts = state.accounts.filter((a) => a.id !== accountId);
      state.rules = state.rules.filter((r) => r.account_id !== accountId);
      const gone = new Set(
        state.schedules
          .filter(
            (s) => s.account_id === accountId || s.to_account_id === accountId,
          )
          .map((s) => s.id),
      );
      state.schedules = state.schedules.filter((s) => !gone.has(s.id));
      state.skips = state.skips.filter((k) => !gone.has(k.schedule_id));
      state.goals = state.goals.map((g) => ({
        ...g,
        money_goal_account: g.money_goal_account.filter(
          (l) => l.account_id !== accountId,
        ),
      }));
      state.loans = state.loans.filter((l) => l.account_id !== accountId);
      state.trades = state.trades.filter((t) => t.account_id !== accountId);
      state.reconciliations = state.reconciliations.filter(
        (r) => r.account_id !== accountId,
      );
      return commit(ok(null));
    },

    listCategories: () =>
      settle(
        ok(
          [...state.categories].sort(
            (a, b) =>
              a.sort_order - b.sort_order || a.name.localeCompare(b.name),
          ),
        ),
      ),
    saveCategory: async (categoryId, row) => {
      const parent = row.parent_id
        ? state.categories.find((c) => c.id === row.parent_id)
        : null;
      if (row.parent_id && !parent) return fail("Parent category not found");
      if (parent?.parent_id)
        return fail("Categories go two levels deep at most");
      if (
        categoryId &&
        row.parent_id &&
        state.categories.some((c) => c.parent_id === categoryId)
      ) {
        return fail(
          "A category with subcategories cannot itself be a subcategory",
        );
      }
      if (
        state.categories.some(
          (c) =>
            c.id !== categoryId &&
            c.parent_id === row.parent_id &&
            c.name.toLowerCase() === row.name.toLowerCase(),
        )
      ) {
        return fail(
          'duplicate key value violates unique constraint "money_category_name_key"',
        );
      }
      const saved: CategoryRow = {
        ...row,
        bucket: parent ? parent.bucket : row.bucket,
        id: categoryId ?? id(),
        archived_at:
          state.categories.find((c) => c.id === categoryId)?.archived_at ??
          null,
      };
      state.categories = [
        ...state.categories
          .filter((c) => c.id !== saved.id)
          .map((c) =>
            c.parent_id === saved.id ? { ...c, bucket: saved.bucket } : c,
          ),
        saved,
      ];
      return commit(ok({ id: saved.id }));
    },
    setCategoryArchived: async (categoryId, archivedAt) => {
      state.categories = state.categories.map((c) =>
        c.id === categoryId ? { ...c, archived_at: archivedAt } : c,
      );
      return commit(ok(null));
    },

    listTransactions: () =>
      settle(ok(sortedTransactions().map(({ created: _created, ...t }) => t))),
    recordTransaction: async (txn, postings) => {
      if (
        txn.import_hash &&
        state.transactions.some((t) => t.import_hash === txn.import_hash)
      ) {
        return fail(
          'duplicate key value violates unique constraint "money_transaction_import_hash_key"',
        );
      }
      if (
        txn.schedule_id &&
        state.transactions.some(
          (t) =>
            t.schedule_id === txn.schedule_id &&
            t.occurrence_date === txn.occurrence_date,
        )
      ) {
        return fail(
          'duplicate key value violates unique constraint "money_transaction_occurrence_key"',
        );
      }
      const built = build(id(), txn, postings);
      if ("error" in built) return built;
      state.transactions.push(built.data);
      return commit(ok(built.data.id));
    },
    updateTransaction: async (txnId, txn, postings) => {
      const existing = state.transactions.find((t) => t.id === txnId);
      if (!existing) return fail("Transaction not found");
      const built = build(txnId, txn, postings, existing);
      if ("error" in built) return built;
      state.transactions = state.transactions.map((t) =>
        t.id === txnId ? built.data : t,
      );
      return commit(ok(txnId));
    },
    deleteTransaction: async (txnId) => {
      state.transactions = state.transactions.filter((t) => t.id !== txnId);
      // A trade goes with its ledger transaction (ON DELETE CASCADE).
      state.trades = state.trades.filter((t) => t.transaction_id !== txnId);
      return commit(ok(null));
    },
    importTransactions: async (batch, rows) => {
      if (!state.accounts.some((a) => a.id === batch.account_id))
        return fail("Account not found");
      if (rows.length > 2000) return fail("At most 2000 rows in one import");
      const known = new Set(
        state.transactions.map((t) => t.import_hash).filter(Boolean),
      );
      const staged: State["transactions"] = [];
      let duplicates = 0;
      for (const row of rows) {
        const hash = row.transaction.import_hash as string | null;
        if (hash && known.has(hash)) {
          duplicates += 1;
          continue;
        }
        const built = build(id(), row.transaction, row.postings);
        // All or nothing, like the RPC.
        if ("error" in built) return built;
        if (hash) known.add(hash);
        staged.push(built.data);
      }
      state.transactions.push(...staged);
      return commit(
        ok({ batch_id: id(), imported: staged.length, duplicates }),
      );
    },

    listRates: () => settle(ok([...state.rates])),
    saveRates: async (rows) => {
      for (const row of rows) {
        if (!(Number(row.rate) > 0) || row.base === row.quote)
          return fail("Not a valid rate");
        state.rates = [
          ...state.rates.filter(
            (r) =>
              !(
                r.base === row.base &&
                r.quote === row.quote &&
                r.as_of === row.as_of
              ),
          ),
          { ...row },
        ];
      }
      return commit(ok(null));
    },

    listRules: () =>
      settle(
        ok(
          [...state.rules]
            .sort((a, b) => b.priority - a.priority || a.created - b.created)
            .map(({ created: _c, ...r }) => r),
        ),
      ),
    saveRule: async (ruleId, row) => {
      if (row.match === "regex") {
        try {
          new RegExp(row.pattern);
        } catch {
          return fail(`Not a valid pattern: ${row.pattern}`);
        }
      }
      if (!row.category_id && !row.payee)
        return fail("money_rule_does_something");
      const created =
        state.rules.find((r) => r.id === ruleId)?.created ?? (clock += 1);
      state.rules = [
        ...state.rules.filter((r) => r.id !== ruleId),
        { ...row, id: ruleId ?? id(), created },
      ];
      return commit(ok(null));
    },
    deleteRule: async (ruleId) => {
      state.rules = state.rules.filter((r) => r.id !== ruleId);
      return commit(ok(null));
    },

    listReconciliations: () =>
      settle(
        ok(
          [...state.reconciliations].sort((a, b) =>
            b.as_of.localeCompare(a.as_of),
          ),
        ),
      ),
    saveReconciliation: async (row) => {
      const existing = state.reconciliations.find(
        (r) => r.account_id === row.account_id && r.as_of === row.as_of,
      );
      state.reconciliations = [
        ...state.reconciliations.filter((r) => r !== existing),
        { ...row, id: existing?.id ?? id() },
      ];
      return commit(ok(null));
    },
    deleteReconciliation: async (recId) => {
      state.reconciliations = state.reconciliations.filter(
        (r) => r.id !== recId,
      );
      return commit(ok(null));
    },

    listSchedules: () =>
      settle(
        ok([...state.schedules].sort((a, b) => a.name.localeCompare(b.name))),
      ),
    saveSchedule: async (scheduleId, row) => {
      if (!["expense", "income", "transfer"].includes(row.kind))
        return fail("money_schedule_kind");
      if ((row.kind === "transfer") !== (row.to_account_id != null))
        return fail("money_schedule_transfer_target");
      if (row.to_account_id && row.to_account_id === row.account_id)
        return fail("money_schedule_distinct_accounts");
      if (row.end_date && row.end_date < row.start_date)
        return fail("money_schedule_ends_after_start");
      if (
        (row.frequency === "semimonthly") !==
        (row.day_one != null && row.day_two != null)
      )
        return fail("money_schedule_semimonthly_days");
      if (row.day_one != null && row.day_one === row.day_two)
        return fail("money_schedule_days_differ");
      if (!(Number(row.amount_minor) > 0))
        return fail("money_schedule_amount_minor_check");
      const archived =
        state.schedules.find((s) => s.id === scheduleId)?.archived_at ?? null;
      state.schedules = [
        ...state.schedules.filter((s) => s.id !== scheduleId),
        { ...row, id: scheduleId ?? id(), archived_at: archived },
      ];
      return commit(ok(null));
    },
    setScheduleArchived: async (scheduleId, archivedAt) => {
      state.schedules = state.schedules.map((s) =>
        s.id === scheduleId ? { ...s, archived_at: archivedAt } : s,
      );
      return commit(ok(null));
    },
    deleteSchedule: async (scheduleId) => {
      state.schedules = state.schedules.filter((s) => s.id !== scheduleId);
      state.skips = state.skips.filter((k) => k.schedule_id !== scheduleId);
      state.transactions = state.transactions.map((t) =>
        t.schedule_id === scheduleId
          ? { ...t, schedule_id: null, occurrence_date: null }
          : t,
      );
      return commit(ok(null));
    },
    listSkips: () => settle(ok([...state.skips])),
    addSkip: async (scheduleId, dueDate) => {
      if (
        !state.skips.some(
          (k) => k.schedule_id === scheduleId && k.due_date === dueDate,
        )
      ) {
        state.skips = [
          ...state.skips,
          { schedule_id: scheduleId, due_date: dueDate },
        ];
      }
      return commit(ok(null));
    },
    removeSkip: async (scheduleId, dueDate) => {
      state.skips = state.skips.filter(
        (k) => !(k.schedule_id === scheduleId && k.due_date === dueDate),
      );
      return commit(ok(null));
    },

    listBudgets: () =>
      settle(
        ok(
          [...state.budgets].sort((a, b) =>
            a.from_month.localeCompare(b.from_month),
          ),
        ),
      ),
    saveBudget: async (row) => {
      if (!/^\d{4}-\d{2}-01$/.test(row.from_month))
        return fail("money_budget_from_month_check");
      if (Number(row.amount_minor) < 0)
        return fail("money_budget_amount_minor_check");
      const existing = state.budgets.find(
        (b) =>
          b.category_id === row.category_id && b.from_month === row.from_month,
      );
      state.budgets = [
        ...state.budgets.filter((b) => b !== existing),
        { ...row, id: existing?.id ?? id() },
      ];
      return commit(ok(null));
    },
    deleteBudget: async (budgetId) => {
      state.budgets = state.budgets.filter((b) => b.id !== budgetId);
      return commit(ok(null));
    },

    listGoals: () =>
      settle(
        ok(
          [...state.goals].sort(
            (a, b) =>
              a.sort_order - b.sort_order || a.name.localeCompare(b.name),
          ),
        ),
      ),
    saveGoal: async (goal, accountIds) => {
      const goalId = (goal.id as string | undefined) || id();
      const taken = state.goals.some(
        (g) =>
          g.id !== goalId &&
          g.money_goal_account.some((l) => accountIds.includes(l.account_id)),
      );
      if (taken)
        return fail(
          'duplicate key value violates unique constraint "money_goal_account_once"',
        );
      if (!(Number(goal.target_minor) > 0))
        return fail("money_goal_target_minor_check");
      const before = state.goals.find((g) => g.id === goalId);
      const row: GoalRow = {
        id: goalId,
        name: String(goal.name),
        target_minor: Number(goal.target_minor),
        currency: String(goal.currency),
        target_date: (goal.target_date as string | null) || null,
        notes: (goal.notes as string | null) || null,
        sort_order: before?.sort_order ?? state.goals.length,
        achieved_at: before?.achieved_at ?? null,
        archived_at: before?.archived_at ?? null,
        money_goal_account: accountIds.map((account_id) => ({ account_id })),
      };
      state.goals = [...state.goals.filter((g) => g.id !== goalId), row];
      return commit(ok(goalId));
    },
    setGoalFlags: async (goalId, flags) => {
      state.goals = state.goals.map((g) =>
        g.id === goalId ? { ...g, ...flags } : g,
      );
      return commit(ok(null));
    },
    deleteGoal: async (goalId) => {
      state.goals = state.goals.filter((g) => g.id !== goalId);
      return commit(ok(null));
    },

    listLoans: () => settle(ok([...state.loans])),
    saveLoan: async (loanId, row) => {
      const account = state.accounts.find((a) => a.id === row.account_id);
      if (
        !account ||
        !["loan", "mortgage", "line_of_credit"].includes(account.kind)
      ) {
        return fail(
          "Loan terms belong on a loan, mortgage or line-of-credit account",
        );
      }
      if (
        state.loans.some(
          (l) => l.id !== loanId && l.account_id === row.account_id,
        )
      )
        return fail("duplicate key value violates unique constraint");
      if (row.term_months != null && row.term_months > row.amortization_months)
        return fail("money_loan_term_within_amortization");
      if (!(Number(row.principal_minor) > 0))
        return fail("money_loan_principal_minor_check");
      state.loans = [
        ...state.loans.filter((l) => l.id !== loanId),
        { ...row, id: loanId ?? id() },
      ];
      return commit(ok(null));
    },
    deleteLoan: async (loanId) => {
      state.loans = state.loans.filter((l) => l.id !== loanId);
      return commit(ok(null));
    },

    listIncomeSources: () =>
      settle(
        ok(
          [...state.incomeSources].sort((a, b) =>
            b.start_date.localeCompare(a.start_date),
          ),
        ),
      ),
    saveIncomeSource: async (sourceId, row) => {
      if (row.end_date && row.end_date < row.start_date)
        return fail("money_income_source_dates");
      if (!(Number(row.gross_annual_minor) > 0))
        return fail("money_income_source_gross_annual_minor_check");
      state.incomeSources = [
        ...state.incomeSources.filter((s) => s.id !== sourceId),
        { ...row, id: sourceId ?? id() },
      ];
      return commit(ok(null));
    },
    deleteIncomeSource: async (sourceId) => {
      state.incomeSources = state.incomeSources.filter(
        (s) => s.id !== sourceId,
      );
      return commit(ok(null));
    },

    listCreditScores: () =>
      settle(
        ok(
          [...state.creditScores].sort((a, b) =>
            a.as_of.localeCompare(b.as_of),
          ),
        ),
      ),
    saveCreditScore: async (row) => {
      if (row.score < 300 || row.score > 900)
        return fail("money_credit_score_score_check");
      const existing = state.creditScores.find(
        (s) => s.bureau === row.bureau && s.as_of === row.as_of,
      );
      state.creditScores = [
        ...state.creditScores.filter((s) => s !== existing),
        { ...row, id: existing?.id ?? id() },
      ];
      return commit(ok(null));
    },
    deleteCreditScore: async (scoreId) => {
      state.creditScores = state.creditScores.filter((s) => s.id !== scoreId);
      return commit(ok(null));
    },

    listApplications: () => settle(ok([...state.applications].reverse())),
    saveApplication: async (appId, row, documents) => {
      if (
        row.decided_on &&
        row.submitted_on &&
        row.decided_on < row.submitted_on
      )
        return fail("money_application_decided_after_submitted");
      if (
        row.down_payment_minor != null &&
        row.purchase_price_minor != null &&
        Number(row.down_payment_minor) > Number(row.purchase_price_minor)
      ) {
        return fail("money_application_down_payment_fits");
      }
      const existing = state.applications.find((a) => a.id === appId);
      const newId = appId ?? id();
      const docs =
        existing?.money_application_doc ??
        documents.map((name, index) => ({
          id: id(),
          application_id: newId,
          name,
          status: "needed" as const,
          note: null,
          sort_order: index,
        }));
      const saved: ApplicationRow = {
        ...row,
        id: newId,
        money_application_doc: docs,
      };
      state.applications = existing
        ? state.applications.map((a) => (a.id === newId ? saved : a))
        : [...state.applications, saved];
      return commit(ok(newId));
    },
    deleteApplication: async (appId) => {
      state.applications = state.applications.filter((a) => a.id !== appId);
      return commit(ok(null));
    },
    saveApplicationDoc: async (applicationId, doc) => {
      const app = state.applications.find((a) => a.id === applicationId);
      if (!app) return fail("Application not found");
      if (
        app.money_application_doc.some(
          (d) =>
            d.id !== doc.id &&
            d.name.toLowerCase() === doc.name.trim().toLowerCase(),
        )
      )
        return fail("duplicate key value violates unique constraint");
      const row = {
        id: doc.id ?? id(),
        application_id: applicationId,
        name: doc.name.trim(),
        status: doc.status as "needed" | "ready" | "sent",
        note: doc.note,
        sort_order: doc.sort_order,
      };
      app.money_application_doc = [
        ...app.money_application_doc.filter((d) => d.id !== row.id),
        row,
      ];
      return commit(ok(null));
    },
    deleteApplicationDoc: async (docId) => {
      for (const app of state.applications)
        app.money_application_doc = app.money_application_doc.filter(
          (d) => d.id !== docId,
        );
      return commit(ok(null));
    },

    listSecurities: () =>
      settle(
        ok(
          [...state.securities].sort((a, b) =>
            a.symbol.localeCompare(b.symbol),
          ),
        ),
      ),
    saveSecurity: async (securityId, row) => {
      if (!/^[A-Z0-9][A-Z0-9.:^-]{0,19}$/.test(row.symbol))
        return fail(
          'new row for relation "money_security" violates check constraint "money_security_symbol_check"',
        );
      if (
        state.securities.some(
          (x) => x.id !== securityId && x.symbol === row.symbol,
        )
      )
        return fail(
          'duplicate key value violates unique constraint "money_security_user_id_symbol_key"',
        );
      const before = state.securities.find((x) => x.id === securityId);
      if (
        before &&
        before.currency !== row.currency &&
        state.trades.some((t) => t.security_id === before.id)
      ) {
        return fail("This security has trades; its currency cannot change");
      }
      const saved: SecurityRow = { ...row, id: securityId ?? id() };
      state.securities = [
        ...state.securities.filter((x) => x.id !== saved.id),
        saved,
      ];
      return commit(ok(saved.id));
    },
    deleteSecurity: async (securityId) => {
      if (state.trades.some((t) => t.security_id === securityId))
        return fail(
          'update or delete on table "money_security" violates foreign key constraint',
        );
      state.securities = state.securities.filter((x) => x.id !== securityId);
      state.prices = state.prices.filter((p) => p.security_id !== securityId);
      return commit(ok(null));
    },
    listPrices: () => settle(ok([...state.prices])),
    savePrices: async (rows) => {
      for (const row of rows) {
        if (!state.securities.some((x) => x.id === row.security_id))
          return fail("Security not found");
        if (!(Number(row.price) > 0)) return fail("money_price_price_check");
      }
      const key = (p: PriceRow) => `${p.security_id}|${p.date}`;
      const replaced = new Set(rows.map(key));
      state.prices = [
        ...state.prices.filter((p) => !replaced.has(key(p))),
        ...rows.map((r) => ({ ...r, price: Number(r.price) })),
      ];
      return commit(ok(null));
    },
    deletePrice: async (securityId, date) => {
      state.prices = state.prices.filter(
        (p) => !(p.security_id === securityId && p.date === date),
      );
      return commit(ok(null));
    },
    listTrades: () => settle(ok([...state.trades])),
    saveTrade: async (input) => {
      const tradeId = (input.id as string | null) ?? undefined;
      const before = tradeId
        ? state.trades.find((t) => t.id === tradeId)
        : undefined;
      if (tradeId && !before) return fail("Trade not found");
      const account = state.accounts.find((a) => a.id === input.account_id);
      if (!account) return fail("Account not found");
      if (account.kind !== "investment")
        return fail("Trades belong in an investment account");
      const date = String(input.date);
      if (date < account.opening_date)
        return fail("A trade cannot come before the account's opening date");
      const securityId = (input.security_id as string | null) ?? null;
      if (securityId) {
        const security = state.securities.find((x) => x.id === securityId);
        if (!security) return fail("Security not found");
        if (security.currency !== account.currency) {
          return fail(
            `This security trades in ${security.currency}, the account holds ${account.currency}: keep a separate account for each currency`,
          );
        }
      }
      const row: TradeRow = {
        id: tradeId ?? id(),
        account_id: account.id,
        security_id: securityId,
        date,
        kind: input.kind as TradeRow["kind"],
        quantity: input.quantity == null ? null : Number(input.quantity),
        amount_minor: Number(input.amount_minor ?? 0),
        fee_minor: Number(input.fee_minor ?? 0),
        transaction_id: null,
        notes: (input.notes as string | null) ?? null,
        created_at:
          before?.created_at ??
          new Date(Date.now() + state.trades.length).toISOString(),
      };
      const problems = validateTrade(tradeFromRow(row));
      if (problems.length)
        return fail(
          `new row for relation "money_trade" violates check constraint "money_trade_shape": ${problems[0]}`,
        );

      let txnId: string | null = null;
      if (LEDGER_TRADE_KINDS.includes(row.kind)) {
        const amount = Number(row.amount_minor);
        const header: RpcTransaction = {
          date,
          kind: row.kind === "fee" ? "expense" : "income",
          status: "cleared",
          description:
            (input.description as string | null) ||
            row.kind.replace("_", " ").replace(/^./, (c) => c.toUpperCase()),
        };
        const postings: RpcPosting[] = [
          {
            account_id: account.id,
            category_id: (input.category_id as string | null) ?? null,
            amount_minor: row.kind === "fee" ? -amount : amount,
            fx_rate: input.fx_rate ?? null,
            base_amount_minor:
              input.base_amount_minor == null
                ? null
                : (row.kind === "fee" ? -1 : 1) *
                  Number(input.base_amount_minor),
          },
        ];
        const existing = before?.transaction_id
          ? state.transactions.find((t) => t.id === before.transaction_id)
          : undefined;
        const built = build(existing?.id ?? id(), header, postings, existing);
        if ("error" in built) return built;
        state.transactions = [
          ...state.transactions.filter((t) => t.id !== built.data.id),
          built.data,
        ];
        txnId = built.data.id;
      } else if (before?.transaction_id) {
        state.transactions = state.transactions.filter(
          (t) => t.id !== before.transaction_id,
        );
      }
      row.transaction_id = txnId;
      state.trades = [...state.trades.filter((t) => t.id !== row.id), row];
      return commit(ok(row.id));
    },
    deleteTrade: async (tradeId) => {
      const trade = state.trades.find((t) => t.id === tradeId);
      if (!trade) return fail("Trade not found");
      state.trades = state.trades.filter((t) => t.id !== tradeId);
      if (trade.transaction_id)
        state.transactions = state.transactions.filter(
          (t) => t.id !== trade.transaction_id,
        );
      return commit(ok(null));
    },
    listRoom: () => settle(ok([...state.room].sort((a, b) => a.year - b.year))),
    saveRoom: async (row) => {
      if (!["tfsa", "rrsp", "fhsa"].includes(row.registration))
        return fail("money_room_registration_check");
      if (row.year < 2009 || row.year > 2100)
        return fail("money_room_year_check");
      const existing = state.room.find(
        (r) => r.registration === row.registration && r.year === row.year,
      );
      state.room = [
        ...state.room.filter((r) => r !== existing),
        { ...row, id: existing?.id ?? id() },
      ];
      return commit(ok(null));
    },
    deleteRoom: async (roomId) => {
      state.room = state.room.filter((r) => r.id !== roomId);
      return commit(ok(null));
    },
  };
}
