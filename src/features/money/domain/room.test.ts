import { describe, expect, it } from "vitest";
import {
  fhsaRoom,
  flowsByYear,
  registeredMovements,
  rrspRoom,
  tfsaLimit,
  tfsaRoom,
  type YearFlows,
} from "./room";

const flows = (entries: [number, number, number][]): Map<number, YearFlows> =>
  new Map(
    entries.map(([y, c, w]) => [y, { contributedMinor: c, withdrawnMinor: w }]),
  );

describe("limits", () => {
  it("knows the TFSA limits and repeats the latest for later years", () => {
    expect(tfsaLimit(2008)).toBe(0);
    expect(tfsaLimit(2015)).toBe(1_000_000);
    expect(tfsaLimit(2026)).toBe(700_000);
    expect(tfsaLimit(2031)).toBe(700_000);
    // Everything from 2009 to 2026 adds up to the CRA's cumulative 109,000.
    let total = 0;
    for (let y = 2009; y <= 2026; y += 1) total += tfsaLimit(y);
    expect(total).toBe(10_900_000);
  });
});

describe("TFSA", () => {
  it("estimates a newcomer's room from the year of residence", () => {
    const s = tfsaRoom(
      2026,
      [],
      flows([
        [2024, 300_000, 0],
        [2026, 100_000, 0],
      ]),
      "2024-05-01",
    );
    // 7,000 (2024) − 3,000 + 7,000 (2025) + 7,000 (2026) = 18,000 at the start of 2026.
    expect(s).toMatchObject({
      basis: "estimated",
      startMinor: 1_800_000,
      contributedMinor: 100_000,
      availableMinor: 1_700_000,
    });
    expect(s.notes[0]).toContain("2024");
  });

  it("gives back a withdrawal on the next 1 January, not the same year", () => {
    const f = flows([[2025, 500_000, 200_000]]);
    const y2025 = tfsaRoom(
      2025,
      [{ registration: "tfsa", year: 2025, roomMinor: 700_000 }],
      f,
      null,
    );
    expect(y2025).toMatchObject({
      basis: "cra",
      availableMinor: 200_000,
      restoresNextYearMinor: 200_000,
    });
    const y2026 = tfsaRoom(
      2026,
      [{ registration: "tfsa", year: 2025, roomMinor: 700_000 }],
      f,
      null,
    );
    // 7,000 − 5,000 + 2,000 back + 7,000 new.
    expect(y2026).toMatchObject({ basis: "carried", startMinor: 1_100_000 });
  });

  it("prefers the CRA figure for the year itself, and shows an over-contribution", () => {
    const s = tfsaRoom(
      2026,
      [
        { registration: "tfsa", year: 2025, roomMinor: 1 },
        { registration: "tfsa", year: 2026, roomMinor: 500_000 },
      ],
      flows([[2026, 600_000, 0]]),
      "2020-01-01",
    );
    expect(s).toMatchObject({
      basis: "cra",
      startMinor: 500_000,
      availableMinor: -100_000,
    });
  });

  it("starts a newcomer's estimate no earlier than the year they turned 18", () => {
    // Resident from 2024 but 18 only in 2025: 2025 and 2026 limits.
    expect(tfsaRoom(2026, [], new Map(), "2024-05-01", 2007)).toMatchObject({
      basis: "estimated",
      startMinor: 1_400_000,
    });
    expect(tfsaRoom(2026, [], new Map(), "2024-05-01", 1990).startMinor).toBe(
      2_100_000,
    );
  });

  it("says when it cannot know", () => {
    expect(tfsaRoom(2026, [], new Map(), null).basis).toBe("unknown");
  });
});

describe("FHSA", () => {
  it("starts the year the first FHSA opens and carries up to 8,000 forward", () => {
    const f = flows([[2025, 300_000, 0]]);
    expect(fhsaRoom(2024, [], f, "2025-03-01").basis).toBe("unknown");
    expect(fhsaRoom(2025, [], f, "2025-03-01")).toMatchObject({
      startMinor: 800_000,
      availableMinor: 500_000,
    });
    // 5,000 unused carries: 8,000 + 5,000.
    expect(fhsaRoom(2026, [], f, "2025-03-01")).toMatchObject({
      startMinor: 1_300_000,
      basis: "estimated",
    });
  });

  it("caps the carry-forward at 8,000 and the lifetime at 40,000", () => {
    expect(fhsaRoom(2026, [], new Map(), "2024-01-01").startMinor).toBe(
      1_600_000,
    );
    const heavy = flows([
      [2023, 800_000, 0],
      [2024, 1_600_000, 0],
      [2025, 1_300_000, 0],
    ]);
    // 37,000 used before 2026: only 3,000 left in the lifetime.
    expect(fhsaRoom(2026, [], heavy, "2023-01-01").startMinor).toBe(300_000);
  });

  it("does not give back withdrawals", () => {
    expect(
      fhsaRoom(2026, [], flows([[2025, 800_000, 800_000]]), "2025-01-01")
        .startMinor,
    ).toBe(800_000);
  });
});

describe("RRSP", () => {
  it("uses the Notice of Assessment figure and projects next year's new room", () => {
    const s = rrspRoom(
      2026,
      [{ registration: "rrsp", year: 2026, roomMinor: 1_620_000 }],
      flows([[2026, 500_000, 0]]),
      9_000_000,
    );
    expect(s).toMatchObject({
      basis: "cra",
      availableMinor: 1_120_000,
      nextYearNewRoomMinor: 1_620_000,
    });
    // Capped at the year's maximum.
    expect(rrspRoom(2026, [], new Map(), 50_000_000).nextYearNewRoomMinor).toBe(
      3_381_000,
    );
    expect(rrspRoom(2026, [], new Map(), 0).basis).toBe("unknown");
  });
});

describe("movements from the ledger", () => {
  const accounts = [
    { id: "chq", registration: "none" as const, currency: "CAD" },
    { id: "tfsa1", registration: "tfsa" as const, currency: "CAD" },
    { id: "tfsa2", registration: "tfsa" as const, currency: "CAD" },
    { id: "tfsaUsd", registration: "tfsa" as const, currency: "USD" },
  ];
  const leg = (
    accountId: string,
    amountMinor: number,
    baseAmountMinor: number | null = amountMinor,
    categoryId: string | null = null,
  ) => ({
    accountId,
    amountMinor,
    categoryId,
    fxRate: null,
    baseAmountMinor,
  });

  it("counts transfers in and out, but not between two TFSAs or income inside one", () => {
    const { movements, unconverted } = registeredMovements(
      "tfsa",
      accounts,
      [
        {
          date: "2026-01-10",
          kind: "transfer",
          postings: [leg("chq", -500_000), leg("tfsa1", 500_000)],
        },
        {
          date: "2026-02-10",
          kind: "transfer",
          postings: [leg("tfsa1", -100_000), leg("tfsa2", 100_000)],
        },
        {
          date: "2026-03-10",
          kind: "income",
          postings: [leg("tfsa1", 5_000, 5_000, "div")],
        },
        {
          date: "2026-04-10",
          kind: "transfer",
          postings: [leg("tfsa2", -50_000), leg("chq", 50_000)],
        },
        {
          date: "2026-05-10",
          kind: "transfer",
          postings: [leg("chq", -140_000), leg("tfsaUsd", 100_000, 140_000)],
        },
      ],
      "CAD",
    );
    expect(unconverted).toBe(0);
    expect(movements).toEqual([
      { date: "2026-01-10", accountId: "tfsa1", amountMinor: 500_000 },
      { date: "2026-04-10", accountId: "tfsa2", amountMinor: -50_000 },
      { date: "2026-05-10", accountId: "tfsaUsd", amountMinor: 140_000 },
    ]);
    expect(flowsByYear(movements).get(2026)).toEqual({
      contributedMinor: 640_000,
      withdrawnMinor: 50_000,
    });
  });

  it("names a non-CAD movement it cannot convert", () => {
    const { movements, unconverted } = registeredMovements(
      "tfsa",
      accounts,
      [
        {
          date: "2026-05-10",
          kind: "transfer",
          postings: [leg("chq", -140_000), leg("tfsaUsd", 100_000, null)],
        },
      ],
      "INR",
    );
    expect(movements).toEqual([]);
    expect(unconverted).toBe(1);
  });
});
