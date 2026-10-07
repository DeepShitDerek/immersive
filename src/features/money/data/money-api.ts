import { adminApi } from "@/store/api/admin/baseApi";
import type { Budget } from "../domain/budget";
import type { RateRow } from "../domain/fx";
import type { Goal } from "../domain/goals";
import type { Application, DocumentStatus } from "../domain/applications";
import type { CreditScore, IncomeSource } from "../domain/lender-report";
import type { Price, Security, Trade } from "../domain/invest";
import type { Schedule } from "../domain/schedule";
import type { Account, Transaction } from "../domain/ledger";
import type {
  Category,
  Institution,
  MoneySettings,
  Reconciliation,
  Rule,
} from "../domain/model";
import { backend, type Result } from "./backend";
import {
  type AccountRecord,
  accountFromRow,
  accountToRow,
  budgetFromRow,
  categoryFromRow,
  goalFromRow,
  applicationFromRow,
  applicationToRow,
  incomeFromRow,
  incomeToRow,
  type Loan,
  loanFromRow,
  loanToRow,
  scoreFromRow,
  priceFromRow,
  type RoomRecord,
  roomFromRow,
  securityFromRow,
  securityToRow,
  type TradeDraft,
  tradeFromRow,
  tradeToRpc,
  scheduleFromRow,
  scheduleToRow,
  DEFAULT_SETTINGS,
  draftToRpc,
  rateFromRow,
  settingsFromRow,
  settingsToRow,
  toMinor,
  type TransactionDraft,
  transactionFromRow,
} from "./rows";

/**
 * The money module's endpoints.
 *
 * Reads map rows to domain objects; every derived figure is computed in
 * `domain/`. Transactions are written only through the write RPCs, so a
 * transfer never exists with one leg. Storage is behind `backend()` —
 * Supabase in the app, an in-memory ledger in the dev harness.
 *
 * Tags follow how often things change: setup (accounts, categories,
 * institutions, settings) is read by everything and edited rarely, so a
 * saved transaction must not invalidate it.
 */

/** Map a successful result, turning a thrown mapping error into an error result. */
function mapResult<T, U>(result: Result<T>, map: (data: T) => U): Result<U> {
  if ("error" in result) return result;
  try {
    return { data: map(result.data) };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

const archivedAt = (archived: boolean) =>
  archived ? new Date().toISOString() : null;

export interface ImportResult {
  batchId: string;
  imported: number;
  duplicates: number;
}

export type CategorySeedNode = {
  name: string;
  bucket: Category["bucket"];
  isEssential: boolean;
  children?: string[];
};

export const moneyApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Settings ──────────────────────────────────────────────────────────
    getMoneySettings: builder.query<MoneySettings & { saved: boolean }, void>({
      queryFn: async () =>
        mapResult(await backend().getSettings(), (row) =>
          row
            ? { ...settingsFromRow(row), saved: true }
            : { ...DEFAULT_SETTINGS, saved: false },
        ),
      providesTags: ["MoneySetup"],
    }),
    saveMoneySettings: builder.mutation<null, MoneySettings>({
      queryFn: (settings) => backend().saveSettings(settingsToRow(settings)),
      invalidatesTags: ["MoneySetup", "MoneyLedger"],
    }),

    // ── Institutions ──────────────────────────────────────────────────────
    getInstitutions: builder.query<Institution[], void>({
      queryFn: () => backend().listInstitutions(),
      providesTags: ["MoneySetup"],
    }),
    saveInstitution: builder.mutation<
      Institution,
      Omit<Institution, "id"> & { id?: string }
    >({
      queryFn: ({ id, ...fields }) =>
        backend().saveInstitution(id, {
          name: fields.name.trim(),
          country: fields.country,
          notes: fields.notes || null,
        }),
      invalidatesTags: ["MoneySetup"],
    }),
    deleteInstitution: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteInstitution(id),
      invalidatesTags: ["MoneySetup"],
    }),

    // ── Accounts ──────────────────────────────────────────────────────────
    getAccounts: builder.query<AccountRecord[], void>({
      queryFn: async () =>
        mapResult(await backend().listAccounts(), (rows) =>
          rows.map(accountFromRow),
        ),
      providesTags: ["MoneySetup"],
    }),
    saveAccount: builder.mutation<
      AccountRecord,
      Omit<AccountRecord, "id" | "archivedAt"> & { id?: string }
    >({
      queryFn: async ({ id, ...account }) =>
        mapResult(
          await backend().saveAccount(id, accountToRow(account)),
          accountFromRow,
        ),
      // Opening balance and date move every balance.
      invalidatesTags: ["MoneySetup", "MoneyLedger"],
    }),
    setAccountArchived: builder.mutation<
      null,
      { id: string; archived: boolean }
    >({
      queryFn: ({ id, archived }) =>
        backend().setAccountArchived(id, archivedAt(archived)),
      invalidatesTags: ["MoneySetup"],
    }),
    /** Refused for an account with history — archive it instead. */
    deleteAccount: builder.mutation<null, Pick<Account, "id">>({
      queryFn: ({ id }) => backend().deleteAccount(id),
      invalidatesTags: ["MoneySetup", "MoneyLedger"],
    }),

    // ── Categories ────────────────────────────────────────────────────────
    getCategories: builder.query<Category[], void>({
      queryFn: async () =>
        mapResult(await backend().listCategories(), (rows) =>
          rows.map(categoryFromRow),
        ),
      providesTags: ["MoneySetup"],
    }),
    saveCategory: builder.mutation<
      null,
      Omit<Category, "id" | "archivedAt"> & { id?: string }
    >({
      queryFn: async ({ id, ...c }) =>
        mapResult(
          await backend().saveCategory(id, {
            parent_id: c.parentId,
            name: c.name.trim(),
            bucket: c.bucket,
            is_essential: c.isEssential,
            icon: c.icon,
            color: c.color,
            sort_order: c.sortOrder,
          }),
          () => null,
        ),
      invalidatesTags: ["MoneySetup"],
    }),
    setCategoryArchived: builder.mutation<
      null,
      { id: string; archived: boolean }
    >({
      queryFn: ({ id, archived }) =>
        backend().setCategoryArchived(id, archivedAt(archived)),
      invalidatesTags: ["MoneySetup"],
    }),
    /**
     * Seed a starter set. Parents first — a child needs its parent's id —
     * and nothing that already exists by name (at its level) is touched.
     */
    seedCategories: builder.mutation<null, CategorySeedNode[]>({
      queryFn: async (tree) => {
        const store = backend();
        const listed = await store.listCategories();
        if ("error" in listed) return listed;
        const existing = listed.data;
        const topId = new Map(
          existing
            .filter((c) => !c.parent_id)
            .map((c) => [c.name.toLowerCase(), c.id]),
        );
        for (const [index, node] of tree.entries()) {
          let parentId = topId.get(node.name.toLowerCase());
          if (!parentId) {
            const made = await store.saveCategory(undefined, {
              parent_id: null,
              name: node.name,
              bucket: node.bucket,
              is_essential: node.isEssential,
              icon: null,
              color: null,
              sort_order: index,
            });
            if ("error" in made) return made;
            parentId = made.data.id;
            topId.set(node.name.toLowerCase(), parentId);
          }
          for (const [childIndex, child] of (node.children ?? []).entries()) {
            const taken = existing.some(
              (c) =>
                c.parent_id === parentId &&
                c.name.toLowerCase() === child.toLowerCase(),
            );
            if (taken) continue;
            const made = await store.saveCategory(undefined, {
              parent_id: parentId,
              name: child,
              bucket: node.bucket,
              is_essential: node.isEssential,
              icon: null,
              color: null,
              sort_order: childIndex,
            });
            if ("error" in made) return made;
          }
        }
        return { data: null };
      },
      invalidatesTags: ["MoneySetup"],
    }),

    // ── Transactions ──────────────────────────────────────────────────────
    getTransactions: builder.query<Transaction[], void>({
      queryFn: async () =>
        mapResult(await backend().listTransactions(), (rows) =>
          rows.map(transactionFromRow),
        ),
      providesTags: ["MoneyLedger"],
    }),
    recordTransaction: builder.mutation<string, TransactionDraft>({
      queryFn: (draft) => {
        const { p_transaction, p_postings } = draftToRpc(draft);
        return backend().recordTransaction(p_transaction, p_postings);
      },
      invalidatesTags: ["MoneyLedger"],
    }),
    updateTransaction: builder.mutation<
      string,
      TransactionDraft & { id: string }
    >({
      queryFn: ({ id, ...draft }) => {
        const { p_transaction, p_postings } = draftToRpc(draft);
        return backend().updateTransaction(id, p_transaction, p_postings);
      },
      invalidatesTags: ["MoneyLedger"],
    }),
    deleteTransaction: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteTransaction(id),
      // A trade's ledger transaction takes the trade with it.
      invalidatesTags: ["MoneyLedger", "MoneyInvest"],
    }),
    importTransactions: builder.mutation<
      ImportResult,
      {
        accountId: string;
        fileName: string | null;
        preset: string | null;
        rowCount: number;
        drafts: TransactionDraft[];
      }
    >({
      queryFn: async ({ accountId, fileName, preset, rowCount, drafts }) =>
        mapResult(
          await backend().importTransactions(
            {
              account_id: accountId,
              file_name: fileName,
              preset,
              row_count: rowCount,
            },
            drafts.map((draft) => {
              const rpc = draftToRpc(draft);
              return {
                transaction: rpc.p_transaction,
                postings: rpc.p_postings,
              };
            }),
          ),
          (row) => ({
            batchId: row.batch_id,
            imported: row.imported,
            duplicates: row.duplicates,
          }),
        ),
      invalidatesTags: ["MoneyLedger"],
    }),

    // ── Rates ─────────────────────────────────────────────────────────────
    getRates: builder.query<RateRow[], void>({
      queryFn: async () =>
        mapResult(await backend().listRates(), (rows) => rows.map(rateFromRow)),
      providesTags: ["MoneyRates"],
    }),
    saveRates: builder.mutation<null, (RateRow & { source: string })[]>({
      queryFn: (rows) =>
        backend().saveRates(
          rows.map((r) => ({
            base: r.base,
            quote: r.quote,
            as_of: r.asOf,
            rate: String(r.rate),
            source: r.source,
          })),
        ),
      invalidatesTags: ["MoneyRates"],
    }),

    // ── Rules ─────────────────────────────────────────────────────────────
    getRules: builder.query<Rule[], void>({
      queryFn: async () =>
        mapResult(await backend().listRules(), (rows) =>
          rows.map((r) => ({
            id: r.id,
            priority: r.priority,
            match: r.match,
            pattern: r.pattern,
            accountId: r.account_id,
            categoryId: r.category_id,
            payee: r.payee,
            isActive: r.is_active,
          })),
        ),
      providesTags: ["MoneyRules"],
    }),
    saveRule: builder.mutation<null, Omit<Rule, "id"> & { id?: string }>({
      queryFn: ({ id, ...rule }) =>
        backend().saveRule(id, {
          priority: rule.priority,
          match: rule.match,
          pattern: rule.pattern.trim(),
          account_id: rule.accountId,
          category_id: rule.categoryId,
          payee: rule.payee?.trim() || null,
          is_active: rule.isActive,
        }),
      invalidatesTags: ["MoneyRules"],
    }),
    deleteRule: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteRule(id),
      invalidatesTags: ["MoneyRules"],
    }),

    // ── Reconciliation ────────────────────────────────────────────────────
    getReconciliations: builder.query<Reconciliation[], void>({
      queryFn: async () =>
        mapResult(await backend().listReconciliations(), (rows) =>
          rows.map((r) => ({
            id: r.id,
            accountId: r.account_id,
            asOf: r.as_of,
            statementBalanceMinor: toMinor(r.statement_balance_minor),
            note: r.note,
          })),
        ),
      providesTags: ["MoneyLedger"],
    }),
    saveReconciliation: builder.mutation<null, Omit<Reconciliation, "id">>({
      queryFn: (r) =>
        backend().saveReconciliation({
          account_id: r.accountId,
          as_of: r.asOf,
          statement_balance_minor: r.statementBalanceMinor,
          note: r.note || null,
        }),
      invalidatesTags: ["MoneyLedger"],
    }),
    deleteReconciliation: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteReconciliation(id),
      invalidatesTags: ["MoneyLedger"],
    }),

    // ── Schedules ─────────────────────────────────────────────────────────
    getSchedules: builder.query<Schedule[], void>({
      queryFn: async () =>
        mapResult(await backend().listSchedules(), (rows) =>
          rows.map(scheduleFromRow),
        ),
      providesTags: ["MoneyPlan"],
    }),
    saveSchedule: builder.mutation<
      null,
      Omit<Schedule, "id" | "archivedAt"> & { id?: string }
    >({
      queryFn: ({ id, ...schedule }) =>
        backend().saveSchedule(id, scheduleToRow(schedule)),
      invalidatesTags: ["MoneyPlan"],
    }),
    setScheduleArchived: builder.mutation<
      null,
      { id: string; archived: boolean }
    >({
      queryFn: ({ id, archived }) =>
        backend().setScheduleArchived(id, archivedAt(archived)),
      invalidatesTags: ["MoneyPlan"],
    }),
    /** Its transactions stay, unlinked. */
    deleteSchedule: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteSchedule(id),
      invalidatesTags: ["MoneyPlan", "MoneyLedger"],
    }),
    getSkips: builder.query<string[], void>({
      queryFn: async () =>
        mapResult(await backend().listSkips(), (rows) =>
          rows.map((r) => `${r.schedule_id}|${r.due_date}`),
        ),
      providesTags: ["MoneyPlan"],
    }),
    skipOccurrence: builder.mutation<
      null,
      { scheduleId: string; dueDate: string; skip: boolean }
    >({
      queryFn: ({ scheduleId, dueDate, skip }) =>
        skip
          ? backend().addSkip(scheduleId, dueDate)
          : backend().removeSkip(scheduleId, dueDate),
      invalidatesTags: ["MoneyPlan"],
    }),

    // ── Budgets ───────────────────────────────────────────────────────────
    getBudgets: builder.query<Budget[], void>({
      queryFn: async () =>
        mapResult(await backend().listBudgets(), (rows) =>
          rows.map(budgetFromRow),
        ),
      providesTags: ["MoneyPlan"],
    }),
    saveBudget: builder.mutation<null, Omit<Budget, "id">>({
      queryFn: (b) =>
        backend().saveBudget({
          category_id: b.categoryId,
          from_month: b.fromMonth,
          amount_minor: b.amountMinor,
          rollover: b.rollover,
        }),
      invalidatesTags: ["MoneyPlan"],
    }),
    deleteBudget: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteBudget(id),
      invalidatesTags: ["MoneyPlan"],
    }),

    // ── Goals ─────────────────────────────────────────────────────────────
    getGoals: builder.query<Goal[], void>({
      queryFn: async () =>
        mapResult(await backend().listGoals(), (rows) => rows.map(goalFromRow)),
      providesTags: ["MoneyPlan"],
    }),
    saveGoal: builder.mutation<
      string,
      Pick<
        Goal,
        | "name"
        | "targetMinor"
        | "currency"
        | "targetDate"
        | "notes"
        | "accountIds"
      > & { id?: string }
    >({
      queryFn: ({ id, accountIds, ...goal }) =>
        backend().saveGoal(
          {
            id: id ?? null,
            name: goal.name.trim(),
            target_minor: goal.targetMinor,
            currency: goal.currency,
            target_date: goal.targetDate,
            notes: goal.notes?.trim() || null,
          },
          accountIds,
        ),
      invalidatesTags: ["MoneyPlan"],
    }),
    setGoalFlags: builder.mutation<
      null,
      { id: string; archived?: boolean; achieved?: boolean }
    >({
      queryFn: ({ id, archived, achieved }) =>
        backend().setGoalFlags(id, {
          ...(archived === undefined
            ? {}
            : { archived_at: archivedAt(archived) }),
          ...(achieved === undefined
            ? {}
            : { achieved_at: archivedAt(achieved) }),
        }),
      invalidatesTags: ["MoneyPlan"],
    }),
    deleteGoal: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteGoal(id),
      invalidatesTags: ["MoneyPlan"],
    }),

    // ── Loans, income, credit, applications ──────────────────────────────
    getLoans: builder.query<Loan[], void>({
      queryFn: async () =>
        mapResult(await backend().listLoans(), (rows) => rows.map(loanFromRow)),
      providesTags: ["MoneyCredit"],
    }),
    saveLoan: builder.mutation<null, Omit<Loan, "id"> & { id?: string }>({
      queryFn: ({ id, ...loan }) => backend().saveLoan(id, loanToRow(loan)),
      invalidatesTags: ["MoneyCredit"],
    }),
    deleteLoan: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteLoan(id),
      invalidatesTags: ["MoneyCredit"],
    }),
    getIncomeSources: builder.query<IncomeSource[], void>({
      queryFn: async () =>
        mapResult(await backend().listIncomeSources(), (rows) =>
          rows.map(incomeFromRow),
        ),
      providesTags: ["MoneyCredit"],
    }),
    saveIncomeSource: builder.mutation<
      null,
      Omit<IncomeSource, "id"> & { id?: string }
    >({
      queryFn: ({ id, ...source }) =>
        backend().saveIncomeSource(id, incomeToRow(source)),
      invalidatesTags: ["MoneyCredit"],
    }),
    deleteIncomeSource: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteIncomeSource(id),
      invalidatesTags: ["MoneyCredit"],
    }),
    getCreditScores: builder.query<CreditScore[], void>({
      queryFn: async () =>
        mapResult(await backend().listCreditScores(), (rows) =>
          rows.map(scoreFromRow),
        ),
      providesTags: ["MoneyCredit"],
    }),
    saveCreditScore: builder.mutation<null, Omit<CreditScore, "id">>({
      queryFn: (s) =>
        backend().saveCreditScore({
          bureau: s.bureau,
          score: s.score,
          as_of: s.asOf,
          source: s.source?.trim() || null,
        }),
      invalidatesTags: ["MoneyCredit"],
    }),
    deleteCreditScore: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteCreditScore(id),
      invalidatesTags: ["MoneyCredit"],
    }),
    getApplications: builder.query<Application[], void>({
      queryFn: async () =>
        mapResult(await backend().listApplications(), (rows) =>
          rows.map(applicationFromRow),
        ),
      providesTags: ["MoneyCredit"],
    }),
    saveApplication: builder.mutation<
      string,
      Omit<Application, "id" | "documents"> & {
        id?: string;
        starterDocuments?: string[];
      }
    >({
      queryFn: ({ id, starterDocuments, ...app }) =>
        backend().saveApplication(
          id,
          applicationToRow(app),
          id ? [] : (starterDocuments ?? []),
        ),
      invalidatesTags: ["MoneyCredit"],
    }),
    deleteApplication: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteApplication(id),
      invalidatesTags: ["MoneyCredit"],
    }),
    saveApplicationDoc: builder.mutation<
      null,
      {
        applicationId: string;
        id?: string;
        name: string;
        status: DocumentStatus;
        note: string | null;
        sortOrder: number;
      }
    >({
      queryFn: ({ applicationId, id, name, status, note, sortOrder }) =>
        backend().saveApplicationDoc(applicationId, {
          id,
          name,
          status,
          note,
          sort_order: sortOrder,
        }),
      invalidatesTags: ["MoneyCredit"],
    }),
    deleteApplicationDoc: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteApplicationDoc(id),
      invalidatesTags: ["MoneyCredit"],
    }),

    // ── Investing ─────────────────────────────────────────────────────────
    getSecurities: builder.query<Security[], void>({
      queryFn: async () =>
        mapResult(await backend().listSecurities(), (rows) =>
          rows.map(securityFromRow),
        ),
      providesTags: ["MoneyInvest"],
    }),
    saveSecurity: builder.mutation<
      string,
      Omit<Security, "id"> & { id?: string }
    >({
      queryFn: ({ id, ...security }) =>
        backend().saveSecurity(id, securityToRow(security)),
      invalidatesTags: ["MoneyInvest"],
    }),
    deleteSecurity: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteSecurity(id),
      invalidatesTags: ["MoneyInvest"],
    }),
    getPrices: builder.query<Price[], void>({
      queryFn: async () =>
        mapResult(await backend().listPrices(), (rows) =>
          rows.map(priceFromRow),
        ),
      providesTags: ["MoneyInvest"],
    }),
    savePrices: builder.mutation<null, Price[]>({
      queryFn: (prices) =>
        backend().savePrices(
          prices.map((p) => ({
            security_id: p.securityId,
            date: p.date,
            price: p.price,
          })),
        ),
      invalidatesTags: ["MoneyInvest"],
    }),
    deletePrice: builder.mutation<null, { securityId: string; date: string }>({
      queryFn: ({ securityId, date }) =>
        backend().deletePrice(securityId, date),
      invalidatesTags: ["MoneyInvest"],
    }),
    getTrades: builder.query<Trade[], void>({
      queryFn: async () =>
        mapResult(await backend().listTrades(), (rows) =>
          rows.map(tradeFromRow),
        ),
      providesTags: ["MoneyInvest"],
    }),
    saveTrade: builder.mutation<string, TradeDraft>({
      queryFn: (draft) => backend().saveTrade(tradeToRpc(draft)),
      invalidatesTags: ["MoneyInvest", "MoneyLedger"],
    }),
    deleteTrade: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteTrade(id),
      invalidatesTags: ["MoneyInvest", "MoneyLedger"],
    }),
    getRoom: builder.query<RoomRecord[], void>({
      queryFn: async () =>
        mapResult(await backend().listRoom(), (rows) => rows.map(roomFromRow)),
      providesTags: ["MoneyInvest"],
    }),
    saveRoom: builder.mutation<null, Omit<RoomRecord, "id">>({
      queryFn: (r) =>
        backend().saveRoom({
          registration: r.registration,
          year: r.year,
          room_minor: r.roomMinor,
          notes: r.notes?.trim() || null,
        }),
      invalidatesTags: ["MoneyInvest"],
    }),
    deleteRoom: builder.mutation<null, string>({
      queryFn: (id) => backend().deleteRoom(id),
      invalidatesTags: ["MoneyInvest"],
    }),
  }),
});

export const {
  useGetMoneySettingsQuery,
  useSaveMoneySettingsMutation,
  useGetInstitutionsQuery,
  useSaveInstitutionMutation,
  useDeleteInstitutionMutation,

  useGetAccountsQuery,
  useSaveAccountMutation,
  useSetAccountArchivedMutation,
  useDeleteAccountMutation,
  useGetCategoriesQuery,
  useSaveCategoryMutation,
  useSetCategoryArchivedMutation,
  useSeedCategoriesMutation,
  useGetTransactionsQuery,
  useRecordTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useImportTransactionsMutation,
  useGetRatesQuery,
  useSaveRatesMutation,
  useGetRulesQuery,
  useSaveRuleMutation,
  useDeleteRuleMutation,
  useGetReconciliationsQuery,
  useSaveReconciliationMutation,
  useDeleteReconciliationMutation,
  useGetSchedulesQuery,
  useSaveScheduleMutation,
  useSetScheduleArchivedMutation,
  useDeleteScheduleMutation,
  useGetSkipsQuery,
  useSkipOccurrenceMutation,
  useGetBudgetsQuery,
  useSaveBudgetMutation,
  useDeleteBudgetMutation,
  useGetGoalsQuery,
  useSaveGoalMutation,
  useSetGoalFlagsMutation,
  useDeleteGoalMutation,
  useGetLoansQuery,
  useSaveLoanMutation,
  useDeleteLoanMutation,
  useGetIncomeSourcesQuery,
  useSaveIncomeSourceMutation,
  useDeleteIncomeSourceMutation,
  useGetCreditScoresQuery,
  useSaveCreditScoreMutation,
  useDeleteCreditScoreMutation,
  useGetApplicationsQuery,
  useSaveApplicationMutation,
  useDeleteApplicationMutation,
  useSaveApplicationDocMutation,
  useDeleteApplicationDocMutation,
  useGetSecuritiesQuery,
  useSaveSecurityMutation,
  useDeleteSecurityMutation,
  useGetPricesQuery,
  useSavePricesMutation,
  useDeletePriceMutation,
  useGetTradesQuery,
  useSaveTradeMutation,
  useDeleteTradeMutation,
  useGetRoomQuery,
  useSaveRoomMutation,
  useDeleteRoomMutation,
} = moneyApi;
