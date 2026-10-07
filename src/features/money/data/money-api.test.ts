import { configureStore } from "@reduxjs/toolkit";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { adminApi } from "@/store/api/admin/baseApi";
import { setBackendForHarness, supabaseBackend } from "./backend";
import { createMemoryBackend } from "./memory-backend";
import { moneyApi } from "./money-api";

/**
 * The endpoints end to end against the in-memory backend: domain drafts →
 * RPC payloads → rows → domain objects again. Catches a field dropped or
 * renamed anywhere along the way.
 */

const memory = createMemoryBackend(null);
setBackendForHarness(memory);
afterAll(() => setBackendForHarness(supabaseBackend));

const makeStore = () =>
  configureStore({
    reducer: { [adminApi.reducerPath]: adminApi.reducer },
    middleware: (m) =>
      m({ serializableCheck: false }).concat(adminApi.middleware),
  });

const account = (overrides: Record<string, unknown>) => ({
  name: "Chequing",
  kind: "chequing" as const,
  registration: "none" as const,
  country: "CA",
  currency: "CAD",
  institutionId: null,
  openingBalanceMinor: 100000,
  openingDate: "2026-01-01",
  creditLimitMinor: null,
  statementDay: null,
  paymentDueDay: null,
  interestRate: null,
  isLiquid: true,
  inNetWorth: true,
  importRef: null,
  color: null,
  notes: null,
  sortOrder: 0,
  ...overrides,
});

describe("money endpoints", () => {
  beforeEach(() => memory.reset());

  it("round-trips settings, accounts, categories and a remittance", async () => {
    const store = makeStore();
    const run = store.dispatch;

    expect(
      (await run(moneyApi.endpoints.getMoneySettings.initiate())).data?.saved,
    ).toBe(false);
    await run(
      moneyApi.endpoints.saveMoneySettings.initiate({
        baseCurrency: "CAD",
        homeCurrency: "INR",
        province: "ON",
        birthYear: 1995,
        residentSince: "2023-05-01",
        needsPct: 55,
        wantsPct: 25,
        savePct: 20,
        emergencyMonths: 6,
      }),
    ).unwrap();
    const settings = (
      await run(
        moneyApi.endpoints.getMoneySettings.initiate(undefined, {
          forceRefetch: true,
        }),
      )
    ).data!;
    expect(settings).toMatchObject({
      saved: true,
      province: "ON",
      needsPct: 55,
    });

    const chq = await run(
      moneyApi.endpoints.saveAccount.initiate(account({})),
    ).unwrap();
    const nro = await run(
      moneyApi.endpoints.saveAccount.initiate(
        account({
          name: "NRO",
          kind: "savings",
          registration: "nro",
          country: "IN",
          currency: "INR",
          openingBalanceMinor: 0,
        }),
      ),
    ).unwrap();
    expect(nro).toMatchObject({ registration: "nro", currency: "INR" });

    await run(
      moneyApi.endpoints.seedCategories.initiate([
        {
          name: "Bank fees",
          bucket: "need",
          isEssential: false,
          children: ["Wire"],
        },
      ]),
    ).unwrap();
    await run(
      moneyApi.endpoints.seedCategories.initiate([
        {
          name: "bank fees",
          bucket: "need",
          isEssential: false,
          children: ["wire", "FX"],
        },
      ]),
    ).unwrap();
    const categories = (
      await run(
        moneyApi.endpoints.getCategories.initiate(undefined, {
          forceRefetch: true,
        }),
      )
    ).data!;
    expect(categories.map((c) => c.name).sort()).toEqual([
      "Bank fees",
      "FX",
      "Wire",
    ]);
    const fees = categories.find((c) => c.name === "Bank fees")!;

    await run(
      moneyApi.endpoints.recordTransaction.initiate({
        date: "2026-02-20",
        kind: "transfer",
        description: "Send home",
        provider: "Wise",
        marketRate: 61,
        postings: [
          {
            accountId: chq.id,
            categoryId: null,
            amountMinor: -100000,
            fxRate: 1,
            baseAmountMinor: -100000,
          },
          {
            accountId: nro.id,
            categoryId: null,
            amountMinor: 6000000,
            fxRate: 0.0163934,
            baseAmountMinor: 98360,
          },
          {
            accountId: chq.id,
            categoryId: fees.id,
            amountMinor: -499,
            fxRate: 1,
            baseAmountMinor: -499,
            memo: "fee",
          },
        ],
      }),
    ).unwrap();

    const [txn] = (
      await run(
        moneyApi.endpoints.getTransactions.initiate(undefined, {
          forceRefetch: true,
        }),
      )
    ).data!;
    expect(txn).toMatchObject({
      kind: "transfer",
      provider: "Wise",
      marketRate: 61,
      status: "cleared",
    });
    expect(txn.postings).toEqual([
      {
        accountId: chq.id,
        categoryId: null,
        amountMinor: -100000,
        memo: null,
        fxRate: 1,
        baseAmountMinor: -100000,
      },
      {
        accountId: nro.id,
        categoryId: null,
        amountMinor: 6000000,
        memo: null,
        fxRate: 0.0163934,
        baseAmountMinor: 98360,
      },
      {
        accountId: chq.id,
        categoryId: fees.id,
        amountMinor: -499,
        memo: "fee",
        fxRate: 1,
        baseAmountMinor: -499,
      },
    ]);
  });

  it("surfaces the ledger's refusals as errors", async () => {
    const store = makeStore();
    const chq = await store
      .dispatch(moneyApi.endpoints.saveAccount.initiate(account({})))
      .unwrap();
    const refused = await store.dispatch(
      moneyApi.endpoints.recordTransaction.initiate({
        date: "2026-02-03",
        kind: "expense",
        description: "Wrong way",
        postings: [
          {
            accountId: chq.id,
            categoryId: null,
            amountMinor: 4500,
            fxRate: 1,
            baseAmountMinor: 4500,
          },
        ],
      }),
    );
    expect("error" in refused && JSON.stringify(refused.error)).toMatch(
      /take money out/,
    );
  });

  it("imports once, then skips the same rows as duplicates", async () => {
    const store = makeStore();
    const chq = await store
      .dispatch(moneyApi.endpoints.saveAccount.initiate(account({})))
      .unwrap();
    const drafts = ["h1", "h2"].map((hash, i) => ({
      date: "2026-03-0" + (i + 2),
      kind: "expense" as const,
      description: "COFFEE",
      importHash: hash,
      postings: [
        {
          accountId: chq.id,
          categoryId: null,
          amountMinor: -250,
          fxRate: 1,
          baseAmountMinor: -250,
        },
      ],
    }));
    const args = {
      accountId: chq.id,
      fileName: "x.csv",
      preset: null,
      rowCount: 2,
      drafts,
    };
    expect(
      await store
        .dispatch(moneyApi.endpoints.importTransactions.initiate(args))
        .unwrap(),
    ).toMatchObject({ imported: 2, duplicates: 0 });
    expect(
      await store
        .dispatch(moneyApi.endpoints.importTransactions.initiate(args))
        .unwrap(),
    ).toMatchObject({ imported: 0, duplicates: 2 });
  });
});
