import { supabase } from "@/supabase/client";
import { NO_DB_ERROR } from "@/store/api/admin/query-helpers";
import type {
  AccountRow,
  BudgetRow,
  CategoryRow,
  ApplicationRow,
  CreditScoreRow,
  GoalRow,
  IncomeSourceRow,
  LoanRow,
  PriceRow,
  RoomRow,
  SecurityRow,
  TradeRow,
  RateDbRow,
  ScheduleRow,
  SettingsRow,
  TransactionRow,
} from "./rows";

/**
 * Where the money module's data lives.
 *
 * The endpoints talk to this interface, not to Supabase directly, so the
 * dev harness can run every screen against an in-memory ledger
 * (`memory-backend.ts`) that enforces the same rules through the domain
 * layer. Production always uses `supabaseBackend`.
 *
 * Results use RTK Query's `{ data } | { error }` shape.
 */

export type Result<T> = { data: T } | { error: unknown };

export interface InstitutionRow {
  id: string;
  name: string;
  country: string;
  notes: string | null;
}

export interface RuleRow {
  id: string;
  priority: number;
  match: "contains" | "starts_with" | "equals" | "regex";
  pattern: string;
  account_id: string | null;
  category_id: string | null;
  payee: string | null;
  is_active: boolean;
}

export interface ReconciliationRow {
  id: string;
  account_id: string;
  as_of: string;
  statement_balance_minor: number | string;
  note: string | null;
}

export type RpcTransaction = Record<string, unknown>;
export type RpcPosting = Record<string, unknown>;

export interface MoneyBackend {
  getSettings(): Promise<Result<SettingsRow | null>>;
  saveSettings(row: Omit<SettingsRow, "user_id">): Promise<Result<null>>;

  listInstitutions(): Promise<Result<InstitutionRow[]>>;
  saveInstitution(
    id: string | undefined,
    row: Omit<InstitutionRow, "id">,
  ): Promise<Result<InstitutionRow>>;
  deleteInstitution(id: string): Promise<Result<null>>;

  listAccounts(): Promise<Result<AccountRow[]>>;
  saveAccount(
    id: string | undefined,
    row: Omit<AccountRow, "id" | "archived_at">,
  ): Promise<Result<AccountRow>>;
  setAccountArchived(
    id: string,
    archivedAt: string | null,
  ): Promise<Result<null>>;
  deleteAccount(id: string): Promise<Result<null>>;

  listCategories(): Promise<Result<CategoryRow[]>>;
  saveCategory(
    id: string | undefined,
    row: Omit<CategoryRow, "id" | "archived_at">,
  ): Promise<Result<{ id: string }>>;
  setCategoryArchived(
    id: string,
    archivedAt: string | null,
  ): Promise<Result<null>>;

  listTransactions(): Promise<Result<TransactionRow[]>>;
  recordTransaction(
    transaction: RpcTransaction,
    postings: RpcPosting[],
  ): Promise<Result<string>>;
  updateTransaction(
    id: string,
    transaction: RpcTransaction,
    postings: RpcPosting[],
  ): Promise<Result<string>>;
  deleteTransaction(id: string): Promise<Result<null>>;
  importTransactions(
    batch: Record<string, unknown>,
    rows: { transaction: RpcTransaction; postings: RpcPosting[] }[],
  ): Promise<
    Result<{ batch_id: string; imported: number; duplicates: number }>
  >;

  listRates(): Promise<Result<RateDbRow[]>>;
  saveRates(rows: RateDbRow[]): Promise<Result<null>>;

  listRules(): Promise<Result<RuleRow[]>>;
  saveRule(
    id: string | undefined,
    row: Omit<RuleRow, "id">,
  ): Promise<Result<null>>;
  deleteRule(id: string): Promise<Result<null>>;

  listReconciliations(): Promise<Result<ReconciliationRow[]>>;
  saveReconciliation(row: Omit<ReconciliationRow, "id">): Promise<Result<null>>;
  deleteReconciliation(id: string): Promise<Result<null>>;

  listSchedules(): Promise<Result<ScheduleRow[]>>;
  saveSchedule(
    id: string | undefined,
    row: Omit<ScheduleRow, "id" | "archived_at">,
  ): Promise<Result<null>>;
  setScheduleArchived(
    id: string,
    archivedAt: string | null,
  ): Promise<Result<null>>;
  deleteSchedule(id: string): Promise<Result<null>>;
  listSkips(): Promise<Result<{ schedule_id: string; due_date: string }[]>>;
  addSkip(scheduleId: string, dueDate: string): Promise<Result<null>>;
  removeSkip(scheduleId: string, dueDate: string): Promise<Result<null>>;

  listBudgets(): Promise<Result<BudgetRow[]>>;
  /** Insert or replace the row for (category, month). */
  saveBudget(row: Omit<BudgetRow, "id">): Promise<Result<null>>;
  deleteBudget(id: string): Promise<Result<null>>;

  listGoals(): Promise<Result<GoalRow[]>>;
  saveGoal(
    goal: Record<string, unknown>,
    accountIds: string[],
  ): Promise<Result<string>>;
  setGoalFlags(
    id: string,
    flags: { archived_at?: string | null; achieved_at?: string | null },
  ): Promise<Result<null>>;
  deleteGoal(id: string): Promise<Result<null>>;

  listLoans(): Promise<Result<LoanRow[]>>;
  saveLoan(
    id: string | undefined,
    row: Omit<LoanRow, "id">,
  ): Promise<Result<null>>;
  deleteLoan(id: string): Promise<Result<null>>;

  listIncomeSources(): Promise<Result<IncomeSourceRow[]>>;
  saveIncomeSource(
    id: string | undefined,
    row: Omit<IncomeSourceRow, "id">,
  ): Promise<Result<null>>;
  deleteIncomeSource(id: string): Promise<Result<null>>;

  listCreditScores(): Promise<Result<CreditScoreRow[]>>;
  saveCreditScore(row: Omit<CreditScoreRow, "id">): Promise<Result<null>>;
  deleteCreditScore(id: string): Promise<Result<null>>;

  listApplications(): Promise<Result<ApplicationRow[]>>;
  /** Returns the id; `documents` are added once, on creation. */
  saveApplication(
    id: string | undefined,
    row: Omit<ApplicationRow, "id" | "money_application_doc">,
    documents: string[],
  ): Promise<Result<string>>;
  deleteApplication(id: string): Promise<Result<null>>;
  saveApplicationDoc(
    applicationId: string,
    doc: {
      id?: string;
      name: string;
      status: string;
      note: string | null;
      sort_order: number;
    },
  ): Promise<Result<null>>;
  deleteApplicationDoc(id: string): Promise<Result<null>>;

  listSecurities(): Promise<Result<SecurityRow[]>>;
  /** Returns the id. */
  saveSecurity(
    id: string | undefined,
    row: Omit<SecurityRow, "id">,
  ): Promise<Result<string>>;
  deleteSecurity(id: string): Promise<Result<null>>;
  listPrices(): Promise<Result<PriceRow[]>>;
  /** Insert or replace the price for each (security, day). */
  savePrices(rows: PriceRow[]): Promise<Result<null>>;
  deletePrice(securityId: string, date: string): Promise<Result<null>>;
  listTrades(): Promise<Result<TradeRow[]>>;
  /** The trade and, for income or a fee, its ledger transaction, together. Returns the id. */
  saveTrade(trade: Record<string, unknown>): Promise<Result<string>>;
  deleteTrade(id: string): Promise<Result<null>>;
  listRoom(): Promise<Result<RoomRow[]>>;
  /** Insert or replace the row for (registration, year). */
  saveRoom(row: Omit<RoomRow, "id">): Promise<Result<null>>;
  deleteRoom(id: string): Promise<Result<null>>;
}

const PAGE = 1000;

/**
 * Every row, a page at a time. PostgREST caps a response at 1,000 rows; a
 * single select would quietly return the first thousand transactions and
 * every balance built on them would be wrong without any error.
 */
async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<Result<T[]>> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { error };
    const list = (data ?? []) as T[];
    rows.push(...list);
    if (list.length < PAGE) return { data: rows };
  }
}

const done = ({ error }: { error: unknown }): Result<null> =>
  error ? { error } : { data: null };

const TRANSACTION_SELECT =
  "id,date,kind,status,description,payee,notes,provider,market_rate,schedule_id,occurrence_date,import_hash,money_posting(account_id,category_id,amount_minor,memo,fx_rate,base_amount_minor)";

function client() {
  if (!supabase) throw NO_DB_ERROR;
  return supabase;
}

async function attempt<T>(
  run: () => Promise<Result<NoInfer<T>>>,
): Promise<Result<T>> {
  try {
    return await run();
  } catch (error) {
    return { error };
  }
}

export const supabaseBackend: MoneyBackend = {
  getSettings: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_settings")
        .select("*")
        .maybeSingle();
      return error ? { error } : { data: (data as SettingsRow | null) ?? null };
    }),
  saveSettings: (row) =>
    attempt(async () =>
      done(await client().from("money_settings").upsert(row)),
    ),

  listInstitutions: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_institution")
        .select("id,name,country,notes")
        .order("name");
      return error ? { error } : { data: (data ?? []) as InstitutionRow[] };
    }),
  saveInstitution: (id, row) =>
    attempt(async () => {
      const query = id
        ? client().from("money_institution").update(row).eq("id", id)
        : client().from("money_institution").insert(row);
      const { data, error } = await query
        .select("id,name,country,notes")
        .single();
      return error ? { error } : { data: data as InstitutionRow };
    }),
  deleteInstitution: (id) =>
    attempt(async () =>
      done(await client().from("money_institution").delete().eq("id", id)),
    ),

  listAccounts: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_account")
        .select("*")
        .order("sort_order")
        .order("name");
      return error ? { error } : { data: (data ?? []) as AccountRow[] };
    }),
  saveAccount: (id, row) =>
    attempt(async () => {
      const query = id
        ? client().from("money_account").update(row).eq("id", id)
        : client().from("money_account").insert(row);
      const { data, error } = await query.select("*").single();
      return error ? { error } : { data: data as AccountRow };
    }),
  setAccountArchived: (id, archivedAt) =>
    attempt(async () =>
      done(
        await client()
          .from("money_account")
          .update({ archived_at: archivedAt })
          .eq("id", id),
      ),
    ),
  deleteAccount: (id) =>
    attempt(async () =>
      done(await client().from("money_account").delete().eq("id", id)),
    ),

  listCategories: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_category")
        .select(
          "id,parent_id,name,bucket,is_essential,icon,color,sort_order,archived_at",
        )
        .order("sort_order")
        .order("name");
      return error ? { error } : { data: (data ?? []) as CategoryRow[] };
    }),
  saveCategory: (id, row) =>
    attempt(async () => {
      const query = id
        ? client().from("money_category").update(row).eq("id", id)
        : client().from("money_category").insert(row);
      const { data, error } = await query.select("id").single();
      return error ? { error } : { data: data as { id: string } };
    }),
  setCategoryArchived: (id, archivedAt) =>
    attempt(async () =>
      done(
        await client()
          .from("money_category")
          .update({ archived_at: archivedAt })
          .eq("id", id),
      ),
    ),

  listTransactions: () =>
    attempt(() => {
      const db = client();
      return fetchAll<TransactionRow>((from, to) =>
        db
          .from("money_transaction")
          .select(TRANSACTION_SELECT)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      );
    }),
  recordTransaction: (transaction, postings) =>
    attempt(async () => {
      const { data, error } = await client().rpc("money_record_transaction", {
        p_transaction: transaction,
        p_postings: postings,
      });
      return error ? { error } : { data: data as string };
    }),
  updateTransaction: (id, transaction, postings) =>
    attempt(async () => {
      const { data, error } = await client().rpc("money_update_transaction", {
        p_id: id,
        p_transaction: transaction,
        p_postings: postings,
      });
      return error ? { error } : { data: data as string };
    }),
  deleteTransaction: (id) =>
    attempt(async () =>
      done(await client().from("money_transaction").delete().eq("id", id)),
    ),
  importTransactions: (batch, rows) =>
    attempt(async () => {
      const { data, error } = await client().rpc("money_import", {
        p_batch: batch,
        p_rows: rows,
      });
      if (error) return { error };
      const row = (Array.isArray(data) ? data[0] : data) as {
        batch_id: string;
        imported: number;
        duplicates: number;
      };
      return { data: row };
    }),

  listRates: () =>
    attempt(() => {
      const db = client();
      return fetchAll<RateDbRow>((from, to) =>
        db
          .from("money_rate")
          .select("base,quote,as_of,rate,source")
          .order("as_of", { ascending: false })
          .order("base")
          .order("quote")
          .range(from, to),
      );
    }),
  saveRates: (rows) =>
    attempt(async () =>
      rows.length
        ? done(await client().from("money_rate").upsert(rows))
        : { data: null },
    ),

  listRules: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_rule")
        .select(
          "id,priority,match,pattern,account_id,category_id,payee,is_active",
        )
        .order("priority", { ascending: false })
        .order("created_at");
      return error ? { error } : { data: (data ?? []) as RuleRow[] };
    }),
  saveRule: (id, row) =>
    attempt(async () =>
      done(
        id
          ? await client().from("money_rule").update(row).eq("id", id)
          : await client().from("money_rule").insert(row),
      ),
    ),
  deleteRule: (id) =>
    attempt(async () =>
      done(await client().from("money_rule").delete().eq("id", id)),
    ),

  listReconciliations: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_reconciliation")
        .select("id,account_id,as_of,statement_balance_minor,note")
        .order("as_of", { ascending: false });
      return error ? { error } : { data: (data ?? []) as ReconciliationRow[] };
    }),
  saveReconciliation: (row) =>
    attempt(async () =>
      done(
        await client()
          .from("money_reconciliation")
          .upsert(row, { onConflict: "account_id,as_of" }),
      ),
    ),
  deleteReconciliation: (id) =>
    attempt(async () =>
      done(await client().from("money_reconciliation").delete().eq("id", id)),
    ),

  listSchedules: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_schedule")
        .select("*")
        .order("name");
      return error ? { error } : { data: (data ?? []) as ScheduleRow[] };
    }),
  saveSchedule: (id, row) =>
    attempt(async () =>
      done(
        id
          ? await client().from("money_schedule").update(row).eq("id", id)
          : await client().from("money_schedule").insert(row),
      ),
    ),
  setScheduleArchived: (id, archivedAt) =>
    attempt(async () =>
      done(
        await client()
          .from("money_schedule")
          .update({ archived_at: archivedAt })
          .eq("id", id),
      ),
    ),
  deleteSchedule: (id) =>
    attempt(async () =>
      done(await client().from("money_schedule").delete().eq("id", id)),
    ),
  listSkips: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_schedule_skip")
        .select("schedule_id,due_date");
      return error
        ? { error }
        : { data: (data ?? []) as { schedule_id: string; due_date: string }[] };
    }),
  addSkip: (scheduleId, dueDate) =>
    attempt(async () =>
      done(
        await client()
          .from("money_schedule_skip")
          .upsert({ schedule_id: scheduleId, due_date: dueDate }),
      ),
    ),
  removeSkip: (scheduleId, dueDate) =>
    attempt(async () =>
      done(
        await client()
          .from("money_schedule_skip")
          .delete()
          .eq("schedule_id", scheduleId)
          .eq("due_date", dueDate),
      ),
    ),

  listBudgets: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_budget")
        .select("id,category_id,from_month,amount_minor,rollover")
        .order("from_month");
      return error ? { error } : { data: (data ?? []) as BudgetRow[] };
    }),
  saveBudget: (row) =>
    attempt(async () =>
      done(
        await client()
          .from("money_budget")
          .upsert(row, { onConflict: "category_id,from_month" }),
      ),
    ),
  deleteBudget: (id) =>
    attempt(async () =>
      done(await client().from("money_budget").delete().eq("id", id)),
    ),

  listGoals: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_goal")
        .select(
          "id,name,target_minor,currency,target_date,notes,sort_order,achieved_at,archived_at,money_goal_account(account_id)",
        )
        .order("sort_order")
        .order("name");
      return error ? { error } : { data: (data ?? []) as GoalRow[] };
    }),
  saveGoal: (goal, accountIds) =>
    attempt(async () => {
      const { data, error } = await client().rpc("money_save_goal", {
        p_goal: goal,
        p_accounts: accountIds,
      });
      return error ? { error } : { data: data as string };
    }),
  setGoalFlags: (id, flags) =>
    attempt(async () =>
      done(await client().from("money_goal").update(flags).eq("id", id)),
    ),
  deleteGoal: (id) =>
    attempt(async () =>
      done(await client().from("money_goal").delete().eq("id", id)),
    ),

  listLoans: () =>
    attempt(async () => {
      const { data, error } = await client().from("money_loan").select("*");
      return error ? { error } : { data: (data ?? []) as LoanRow[] };
    }),
  saveLoan: (id, row) =>
    attempt(async () =>
      done(
        id
          ? await client().from("money_loan").update(row).eq("id", id)
          : await client().from("money_loan").insert(row),
      ),
    ),
  deleteLoan: (id) =>
    attempt(async () =>
      done(await client().from("money_loan").delete().eq("id", id)),
    ),

  listIncomeSources: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_income_source")
        .select("*")
        .order("start_date", { ascending: false });
      return error ? { error } : { data: (data ?? []) as IncomeSourceRow[] };
    }),
  saveIncomeSource: (id, row) =>
    attempt(async () =>
      done(
        id
          ? await client().from("money_income_source").update(row).eq("id", id)
          : await client().from("money_income_source").insert(row),
      ),
    ),
  deleteIncomeSource: (id) =>
    attempt(async () =>
      done(await client().from("money_income_source").delete().eq("id", id)),
    ),

  listCreditScores: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_credit_score")
        .select("id,bureau,score,as_of,source")
        .order("as_of");
      return error ? { error } : { data: (data ?? []) as CreditScoreRow[] };
    }),
  saveCreditScore: (row) =>
    attempt(async () =>
      done(
        await client()
          .from("money_credit_score")
          .upsert(row, { onConflict: "user_id,bureau,as_of" }),
      ),
    ),
  deleteCreditScore: (id) =>
    attempt(async () =>
      done(await client().from("money_credit_score").delete().eq("id", id)),
    ),

  listApplications: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_application")
        .select(
          "*, money_application_doc(id,application_id,name,status,note,sort_order)",
        )
        .order("created_at", { ascending: false });
      return error ? { error } : { data: (data ?? []) as ApplicationRow[] };
    }),
  saveApplication: (id, row, documents) =>
    attempt(async () => {
      const db = client();
      if (id) {
        const { error } = await db
          .from("money_application")
          .update(row)
          .eq("id", id);
        return error ? { error } : { data: id };
      }
      // One call, so an application never exists without its checklist.
      const { data, error } = await db.rpc("money_create_application", {
        p_application: row,
        p_documents: documents,
      });
      return error ? { error } : { data: data as string };
    }),
  deleteApplication: (id) =>
    attempt(async () =>
      done(await client().from("money_application").delete().eq("id", id)),
    ),
  saveApplicationDoc: (applicationId, doc) =>
    attempt(async () => {
      const row = {
        application_id: applicationId,
        name: doc.name.trim(),
        status: doc.status,
        note: doc.note,
        sort_order: doc.sort_order,
      };
      return done(
        doc.id
          ? await client()
              .from("money_application_doc")
              .update(row)
              .eq("id", doc.id)
          : await client().from("money_application_doc").insert(row),
      );
    }),
  deleteApplicationDoc: (id) =>
    attempt(async () =>
      done(await client().from("money_application_doc").delete().eq("id", id)),
    ),

  listSecurities: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_security")
        .select("id,symbol,name,currency,asset_class,region,notes")
        .order("symbol");
      return error ? { error } : { data: (data ?? []) as SecurityRow[] };
    }),
  saveSecurity: (id, row) =>
    attempt(async () => {
      const db = client();
      const { data, error } = id
        ? await db
            .from("money_security")
            .update(row)
            .eq("id", id)
            .select("id")
            .single()
        : await db.from("money_security").insert(row).select("id").single();
      return error ? { error } : { data: (data as { id: string }).id };
    }),
  deleteSecurity: (id) =>
    attempt(async () =>
      done(await client().from("money_security").delete().eq("id", id)),
    ),
  listPrices: () =>
    attempt(async () => {
      const db = client();
      return fetchAll<PriceRow>((from, to) =>
        db
          .from("money_price")
          .select("security_id,date,price")
          .order("security_id")
          .order("date")
          .range(from, to),
      );
    }),
  savePrices: (rows) =>
    attempt(async () =>
      rows.length
        ? done(
            await client()
              .from("money_price")
              .upsert(rows, { onConflict: "security_id,date" }),
          )
        : { data: null },
    ),
  deletePrice: (securityId, date) =>
    attempt(async () =>
      done(
        await client()
          .from("money_price")
          .delete()
          .eq("security_id", securityId)
          .eq("date", date),
      ),
    ),
  listTrades: () =>
    attempt(async () => {
      const db = client();
      return fetchAll<TradeRow>((from, to) =>
        db
          .from("money_trade")
          .select(
            "id,account_id,security_id,date,kind,quantity,amount_minor,fee_minor,transaction_id,notes,created_at",
          )
          .order("date")
          .order("created_at")
          .order("id")
          .range(from, to),
      );
    }),
  saveTrade: (trade) =>
    attempt(async () => {
      const { data, error } = await client().rpc("money_save_trade", {
        p_trade: trade,
      });
      return error ? { error } : { data: data as string };
    }),
  deleteTrade: (id) =>
    attempt(async () =>
      done(await client().rpc("money_delete_trade", { p_id: id })),
    ),
  listRoom: () =>
    attempt(async () => {
      const { data, error } = await client()
        .from("money_room")
        .select("id,registration,year,room_minor,notes")
        .order("year");
      return error ? { error } : { data: (data ?? []) as RoomRow[] };
    }),
  saveRoom: (row) =>
    attempt(async () =>
      done(
        await client()
          .from("money_room")
          .upsert(row, { onConflict: "user_id,registration,year" }),
      ),
    ),
  deleteRoom: (id) =>
    attempt(async () =>
      done(await client().from("money_room").delete().eq("id", id)),
    ),
};

let active: MoneyBackend = supabaseBackend;

/** The backend the endpoints use. Only the dev harness ever swaps it. */
export const backend = (): MoneyBackend => active;

export function setBackendForHarness(next: MoneyBackend): void {
  active = next;
}
