import { type IsoDate, yearOf } from "./dates";
import type { Account, Registration, Transaction } from "./ledger";

/**
 * Contribution room for TFSA, FHSA and RRSP.
 *
 * The CRA's own figure is the truth: the owner copies it from My Account
 * (or, for RRSP, the Notice of Assessment) as the room at the start of a
 * year. Contributions and withdrawals since are read from the ledger:
 * transfers into or out of accounts with that registration from anywhere
 * else. Without a CRA figure, room is estimated from the rules, and says so.
 *
 * Limits are the published ones through RULES_YEAR; later years repeat
 * the last known limit until updated.
 */

export const ROOM_REGISTRATIONS = ["tfsa", "fhsa", "rrsp"] as const;
export type RoomRegistration = (typeof ROOM_REGISTRATIONS)[number];

/** TFSA annual dollar limits, in cents. */
const TFSA_LIMITS: Record<number, number> = {
  2009: 500_000,
  2010: 500_000,
  2011: 500_000,
  2012: 500_000,
  2013: 550_000,
  2014: 550_000,
  2015: 1_000_000,
  2016: 550_000,
  2017: 550_000,
  2018: 550_000,
  2019: 600_000,
  2020: 600_000,
  2021: 600_000,
  2022: 600_000,
  2023: 650_000,
  2024: 700_000,
  2025: 700_000,
  2026: 700_000,
};
/** RRSP dollar maximums (the cap on 18% of the previous year's earned income), in cents. */
const RRSP_LIMITS: Record<number, number> = {
  2023: 3_078_000,
  2024: 3_156_000,
  2025: 3_249_000,
  2026: 3_381_000,
};
const FHSA_ANNUAL = 800_000;
const FHSA_LIFETIME = 4_000_000;
const FHSA_CARRY_MAX = 800_000;

/** The limit for a year, or the latest published before it; zero before the table starts. */
const lastKnown = (table: Record<number, number>, year: number): number => {
  const known = Object.keys(table)
    .map(Number)
    .filter((y) => y <= year);
  return known.length ? table[Math.max(...known)] : 0;
};
export const tfsaLimit = (year: number): number =>
  year < 2009 ? 0 : lastKnown(TFSA_LIMITS, year);
const rrspLimit = (year: number): number => lastKnown(RRSP_LIMITS, year);

export interface RoomEntry {
  registration: RoomRegistration;
  year: number;
  /** Room at the start of the year, as the CRA reports it (cents, CAD). */
  roomMinor: number;
}

export interface YearFlows {
  contributedMinor: number;
  withdrawnMinor: number;
}

export interface Movement {
  date: IsoDate;
  accountId: string;
  /** Positive in, negative out, in CAD cents. */
  amountMinor: number;
}

/**
 * Money moved into or out of accounts with this registration from any
 * account without it. Moving between two TFSAs is neither. Non-CAD
 * accounts count at their frozen base amount when the base is CAD, and are
 * otherwise listed as unconverted.
 */
export function registeredMovements(
  registration: Registration,
  accounts: readonly Pick<Account, "id" | "registration" | "currency">[],
  transactions: readonly Pick<Transaction, "date" | "kind" | "postings">[],
  base: string,
): { movements: Movement[]; unconverted: number } {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const movements: Movement[] = [];
  let unconverted = 0;
  for (const txn of transactions) {
    if (txn.kind !== "transfer") continue;
    const inside = txn.postings.filter(
      (p) =>
        !p.categoryId && byId.get(p.accountId)?.registration === registration,
    );
    if (inside.length === 0) continue;
    const outside = txn.postings.some(
      (p) =>
        !p.categoryId && byId.get(p.accountId)?.registration !== registration,
    );
    if (!outside) continue;
    for (const p of inside) {
      const account = byId.get(p.accountId)!;
      const cad =
        account.currency === "CAD"
          ? p.amountMinor
          : base === "CAD"
            ? p.baseAmountMinor
            : null;
      if (cad === null) {
        unconverted += 1;
        continue;
      }
      movements.push({
        date: txn.date,
        accountId: p.accountId,
        amountMinor: cad,
      });
    }
  }
  return { movements, unconverted };
}

export function flowsByYear(
  movements: readonly Movement[],
): Map<number, YearFlows> {
  const years = new Map<number, YearFlows>();
  for (const m of movements) {
    const y = yearOf(m.date);
    const f = years.get(y) ?? { contributedMinor: 0, withdrawnMinor: 0 };
    if (m.amountMinor > 0) f.contributedMinor += m.amountMinor;
    else f.withdrawnMinor -= m.amountMinor;
    years.set(y, f);
  }
  return years;
}

export interface RoomStatus {
  registration: RoomRegistration;
  year: number;
  /** Room at the start of the year. */
  startMinor: number;
  contributedMinor: number;
  withdrawnMinor: number;
  /** What can still go in this year without penalty (negative = over-contributed). */
  availableMinor: number;
  /** Where the start figure came from. */
  basis: "cra" | "carried" | "estimated" | "unknown";
  /** Added back on 1 January next year (TFSA withdrawals). */
  restoresNextYearMinor: number;
  notes: string[];
}

const none: YearFlows = { contributedMinor: 0, withdrawnMinor: 0 };

/**
 * TFSA: room accrues every year from 2009 once you are 18 and resident; a
 * withdrawal comes back the next 1 January. Anchored on the latest CRA
 * figure at or before the year, then carried forward; with none, estimated
 * from the year of residence.
 */
export function tfsaRoom(
  year: number,
  entries: readonly RoomEntry[],
  flows: ReadonlyMap<number, YearFlows>,
  residentSince: IsoDate | null,
  birthYear: number | null = null,
): RoomStatus {
  const anchors = entries
    .filter((e) => e.registration === "tfsa" && e.year <= year)
    .sort((a, b) => b.year - a.year);
  const notes: string[] = [];
  let start: number;
  let basis: RoomStatus["basis"];
  if (anchors.length > 0) {
    const anchor = anchors[0];
    start = anchor.roomMinor;
    for (let y = anchor.year; y < year; y += 1) {
      const f = flows.get(y) ?? none;
      start += -f.contributedMinor + f.withdrawnMinor + tfsaLimit(y + 1);
    }
    basis = anchor.year === year ? "cra" : "carried";
  } else if (residentSince) {
    // Room accrues from the later of 2009, becoming resident, and turning 18.
    const from = Math.max(
      2009,
      yearOf(residentSince),
      birthYear !== null ? birthYear + 18 : 0,
    );
    start = 0;
    for (let y = from; y <= year; y += 1) {
      start += tfsaLimit(y);
      if (y < year) {
        const f = flows.get(y) ?? none;
        start += -f.contributedMinor + f.withdrawnMinor;
      }
    }
    basis = "estimated";
    notes.push(
      birthYear !== null
        ? `Estimated from ${from}, when you were both resident and 18 or older. Check the CRA figure in My Account.`
        : `Estimated from ${from}, the year you became resident, assuming you were 18 or older (add your birth year in Settings to be sure). Check the CRA figure in My Account.`,
    );
  } else {
    start = 0;
    basis = "unknown";
    notes.push(
      "Add the room the CRA shows in My Account, or your date of residence in Settings for an estimate.",
    );
  }
  const f = flows.get(year) ?? none;
  return {
    registration: "tfsa",
    year,
    startMinor: start,
    contributedMinor: f.contributedMinor,
    withdrawnMinor: f.withdrawnMinor,
    availableMinor: start - f.contributedMinor,
    basis,
    restoresNextYearMinor: f.withdrawnMinor,
    notes,
  };
}

/**
 * FHSA: 8,000 a year from the year the first FHSA opens, up to 40,000 in a
 * lifetime; up to 8,000 unused carries into the next year. Withdrawals do
 * not restore room. A CRA figure for a year replaces the computed start.
 */
export function fhsaRoom(
  year: number,
  entries: readonly RoomEntry[],
  flows: ReadonlyMap<number, YearFlows>,
  openedOn: IsoDate | null,
): RoomStatus {
  const notes: string[] = [];
  const f = flows.get(year) ?? none;
  if (!openedOn || yearOf(openedOn) > year) {
    return {
      registration: "fhsa",
      year,
      startMinor: 0,
      contributedMinor: f.contributedMinor,
      withdrawnMinor: f.withdrawnMinor,
      availableMinor: -f.contributedMinor,
      basis: "unknown",
      restoresNextYearMinor: 0,
      notes: [
        "Room starts the year you open your first FHSA — then 8,000 a year, 40,000 in all.",
      ],
    };
  }
  const cra = new Map(
    entries
      .filter((e) => e.registration === "fhsa")
      .map((e) => [e.year, e.roomMinor]),
  );
  let carry = 0;
  let lifetime = 0;
  let start = 0;
  let basis: RoomStatus["basis"] = "estimated";
  for (let y = yearOf(openedOn); y <= year; y += 1) {
    const computed = Math.max(
      0,
      Math.min(FHSA_ANNUAL + carry, FHSA_LIFETIME - lifetime),
    );
    start = cra.get(y) ?? computed;
    basis = cra.has(y) ? "cra" : basis === "cra" ? "carried" : basis;
    const used = (flows.get(y) ?? none).contributedMinor;
    lifetime += used;
    carry = Math.min(FHSA_CARRY_MAX, Math.max(0, start - used));
  }
  if (FHSA_LIFETIME - lifetime + f.contributedMinor <= 0)
    notes.push("The 40,000 lifetime limit is used up.");
  return {
    registration: "fhsa",
    year,
    startMinor: start,
    contributedMinor: f.contributedMinor,
    withdrawnMinor: f.withdrawnMinor,
    availableMinor: start - f.contributedMinor,
    basis,
    restoresNextYearMinor: 0,
    notes,
  };
}

/**
 * RRSP: the deduction limit on the Notice of Assessment is the start. Next
 * year adds 18% of this year's earned income, up to that year's maximum —
 * a newcomer's first Canadian year of income creates the first room.
 * (Contributions in the first 60 days of a year can count for the year
 * before; they are counted here in the year they were made.)
 */
export function rrspRoom(
  year: number,
  entries: readonly RoomEntry[],
  flows: ReadonlyMap<number, YearFlows>,
  earnedIncomeMinor: number,
): RoomStatus & { nextYearNewRoomMinor: number } {
  const anchor = entries.find(
    (e) => e.registration === "rrsp" && e.year === year,
  );
  const f = flows.get(year) ?? none;
  const nextYearNewRoom = Math.min(
    Math.round(earnedIncomeMinor * 0.18),
    rrspLimit(year + 1),
  );
  return {
    registration: "rrsp",
    year,
    startMinor: anchor?.roomMinor ?? 0,
    contributedMinor: f.contributedMinor,
    withdrawnMinor: f.withdrawnMinor,
    availableMinor: (anchor?.roomMinor ?? 0) - f.contributedMinor,
    basis: anchor ? "cra" : "unknown",
    restoresNextYearMinor: 0,
    notes: anchor
      ? []
      : [
          "Copy the RRSP deduction limit from your latest Notice of Assessment. In your first year in Canada it is usually zero.",
        ],
    nextYearNewRoomMinor: nextYearNewRoom,
  };
}
