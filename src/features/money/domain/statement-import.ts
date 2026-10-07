import { type IsoDate, isIsoDate, makeDate } from "./dates";
import type { Posting, TransactionKind } from "./ledger";
import type { Rule } from "./model";
import { MoneyError, parseAmount } from "./money";
import { applyRules, normaliseText } from "./rules";

/**
 * Turning a bank's CSV export into ledger transactions.
 *
 * Banks disagree on everything: RBC splits the description over two
 * columns and has one amount column per currency (CAD$, USD$), CIBC and TD
 * have no header and separate money-out/money-in columns, HDFC writes
 * "Withdrawal Amt." and dates as 05/02/26, SBI writes "5 Feb 2026", and a
 * credit-card export usually lists a purchase as a *positive* number. So the
 * mapping is guessed from the file (header words, then cell contents) and
 * always shown for the owner to correct — never silently assumed.
 *
 * Every row gets a deterministic hash (account, date, amount, description,
 * and how many identical rows came before it in the file), so importing an
 * overlapping statement skips what is already in the ledger — including a
 * genuine second identical coffee on the same day.
 */

export type DateOrder = "ymd" | "mdy" | "dmy";

export interface ColumnMapping {
  hasHeader: boolean;
  date: number;
  description: number;
  /** A second description column to append (RBC's "Description 2"). */
  descriptionExtra: number | null;
  /** One signed amount column… */
  amount: number | null;
  /** …or money-out and money-in columns. */
  debit: number | null;
  credit: number | null;
  /** A column saying DR/CR (or Debit/Credit) for an unsigned amount. */
  direction: number | null;
  dateOrder: DateOrder;
  /** Card exports list purchases as positive; flip so they leave the account. */
  invertSign: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function year(text: string): number {
  const n = Number(text);
  if (text.length === 2) return n < 70 ? 2000 + n : 1900 + n;
  return n;
}

function safeDate(y: number, m: number, d: number): IsoDate | null {
  try {
    const date = makeDate(y, m, d);
    return isIsoDate(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * A statement date in `order`, or null. Month names settle the order by
 * themselves ("05-Feb-2026", "Feb 5, 2026"), as do four-digit leading years
 * and compact 20260205.
 */
export function parseStatementDate(
  raw: string,
  order: DateOrder,
): IsoDate | null {
  const text = raw.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!text) return null;

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (compact) return safeDate(+compact[1], +compact[2], +compact[3]);

  // A time after the date ("2026-02-05 14:03:00") is not part of the day.
  const dateOnly = text.split(/[ T](?=\d{1,2}:\d{2})/)[0];

  const named = /^(\d{1,2})[\s\-./]?([A-Za-z]{3,9})[\s\-./]?(\d{2,4})$/.exec(
    dateOnly,
  );
  if (named) {
    const month =
      MONTHS[named[2].slice(0, 4).toLowerCase()] ??
      MONTHS[named[2].slice(0, 3).toLowerCase()];
    return month ? safeDate(year(named[3]), month, +named[1]) : null;
  }
  const namedFirst =
    /^([A-Za-z]{3,9})[\s\-./]?(\d{1,2})[\s\-./]+(\d{2,4})$/.exec(dateOnly);
  if (namedFirst) {
    const month =
      MONTHS[namedFirst[1].slice(0, 4).toLowerCase()] ??
      MONTHS[namedFirst[1].slice(0, 3).toLowerCase()];
    return month ? safeDate(year(namedFirst[3]), month, +namedFirst[2]) : null;
  }

  const numeric = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(dateOnly);
  if (!numeric) return null;
  const [a, b, c] = [numeric[1], numeric[2], numeric[3]];
  if (a.length === 4) return safeDate(+a, +b, +c); // 2026-02-05 whatever the order says
  if (c.length !== 4 && c.length !== 2) return null;
  switch (order) {
    case "ymd":
      return null;
    case "mdy":
      return safeDate(year(c), +a, +b);
    case "dmy":
      return safeDate(year(c), +b, +a);
  }
}

/**
 * Which day/month order fits every date in the column. When both do (no day
 * above 12 anywhere), the account's country breaks the tie — Canadian
 * banks mostly write MM/DD, Indian banks DD/MM — and `ambiguous` tells the
 * screen to ask.
 */
export function detectDateOrder(
  values: readonly string[],
  country: string,
): { order: DateOrder; ambiguous: boolean } | null {
  const filled = values.filter((v) => v.trim());
  if (filled.length === 0) return null;
  const fits = (["ymd", "dmy", "mdy"] as const).filter((order) =>
    filled.every((value) => parseStatementDate(value, order) !== null),
  );
  if (fits.length === 0) return null;
  if (fits.includes("ymd") && fits.length === 3) {
    // Year-first or month-named dates parse under every order: not ambiguous.
    return { order: "ymd", ambiguous: false };
  }
  const preferred: DateOrder =
    country === "CA" || country === "US" ? "mdy" : "dmy";
  if (fits.length === 1) return { order: fits[0], ambiguous: false };
  return {
    order: fits.includes(preferred) ? preferred : fits[0],
    ambiguous: true,
  };
}

// In order: a "Dr/Cr" header has to be claimed as the direction before the
// debit and credit words can take it.
const HEADER_WORDS: { key: keyof ColumnMapping; pattern: RegExp }[] = [
  {
    key: "direction",
    pattern: /dr\s*\/\s*cr|cr\s*\/\s*dr|debit\s*\/\s*credit|^type$/i,
  },
  {
    key: "date",
    pattern: /(transaction|txn|trans\.?|posted|posting|booking)?\s*date|^date/i,
  },
  {
    key: "description",
    pattern: /desc|narration|details|particulars|merchant|payee|memo|remark/i,
  },
  {
    key: "debit",
    pattern: /debit|withdrawal|money out|paid out|\bdr\b|spent/i,
  },
  {
    key: "credit",
    pattern: /credit|deposit|money in|paid in|\bcr\b|received/i,
  },
  { key: "amount", pattern: /amount|amt|cad\$|^value$|^inr|^cad$/i },
];

const isAmount = (cell: string) => {
  if (!cell.trim()) return false;
  try {
    parseAmount(cell, "CAD");
    return true;
  } catch {
    return false;
  }
};

const signedMinor = (cell: string) => {
  try {
    return parseAmount(cell, "CAD").minor;
  } catch {
    return null;
  }
};

/**
 * A first guess at the mapping. Header words when there is a header (a
 * first row with no date and no amounts in it), cell contents otherwise.
 *
 * `currency` picks RBC's USD$ column over CAD$ for a US-dollar account.
 * `card` says the account is a card or credit line: a single amount column
 * that is mostly positive is then read as purchases-positive and flipped.
 * Money-out/money-in columns (CIBC) and mostly-negative amounts (RBC) already
 * say which way the money went, so they are left alone.
 */
export function guessMapping(
  rows: readonly string[][],
  country: string,
  options: { currency?: string; card?: boolean } = {},
): ColumnMapping | null {
  if (rows.length === 0) return null;
  const width = Math.max(...rows.map((r) => r.length));
  const first = rows[0];
  const hasHeader =
    !first.some((cell) => detectDateOrder([cell], country) !== null) &&
    !first.some((cell) => isAmount(cell) && /\d/.test(cell));
  const data = hasHeader ? rows.slice(1) : rows;
  if (data.length === 0) return null;
  const column = (index: number) => data.map((r) => r[index] ?? "");

  const mapping: ColumnMapping = {
    hasHeader,
    date: -1,
    description: -1,
    descriptionExtra: null,
    amount: null,
    debit: null,
    credit: null,
    direction: null,
    dateOrder: "ymd",
    invertSign: false,
  };

  if (hasHeader) {
    const taken = new Set<number>();
    for (const { key, pattern } of HEADER_WORDS) {
      // "Value date" is when interest counts, not when it happened.
      const index = first.findIndex(
        (cell, i) =>
          !taken.has(i) &&
          pattern.test(cell) &&
          !(key === "date" && /value/i.test(cell)),
      );
      if (index === -1) continue;
      if (key === "description" && mapping.description !== -1) continue;
      if (key === "date" && mapping.date !== -1) continue;
      taken.add(index);
      (mapping[key] as number) = index;
      if (key === "description") {
        const extra = first.findIndex(
          (cell, i) => i !== index && !taken.has(i) && pattern.test(cell),
        );
        if (extra !== -1) {
          mapping.descriptionExtra = extra;
          taken.add(extra);
        }
      }
    }
    if (mapping.date === -1) {
      mapping.date = first.findIndex((cell) => /date/i.test(cell));
    }
    // RBC: "CAD$" and "USD$" — the account's own currency column wins.
    const currency = options.currency?.toUpperCase();
    const own = currency
      ? first.findIndex(
          (cell) => cell.replace(/[^A-Za-z]/g, "").toUpperCase() === currency,
        )
      : -1;
    if (
      own !== -1 &&
      mapping.debit === null &&
      mapping.credit === null &&
      own !== mapping.date
    )
      mapping.amount = own;
    if (mapping.debit !== null && mapping.credit !== null)
      mapping.amount = null;
    else if (
      mapping.amount === null &&
      (mapping.debit !== null || mapping.credit !== null)
    ) {
      mapping.amount = mapping.debit ?? mapping.credit;
      mapping.debit = null;
      mapping.credit = null;
    }
  }

  // Fill anything the header did not settle from the cells themselves.
  if (mapping.date === -1) {
    mapping.date =
      [...Array(width).keys()].find(
        (i) => detectDateOrder(column(i), country) !== null,
      ) ?? -1;
  }
  if (mapping.date === -1) return null;
  const numeric = [...Array(width).keys()].filter(
    (i) =>
      i !== mapping.date &&
      column(i).some((cell) => isAmount(cell)) &&
      column(i).every((cell) => !cell.trim() || isAmount(cell)),
  );
  if (
    mapping.amount === null &&
    mapping.debit === null &&
    mapping.credit === null
  ) {
    const sparse = numeric.filter((i) =>
      column(i).some((cell) => !cell.trim()),
    );
    const blank = (i: number) =>
      i >= 0 &&
      i < width &&
      i !== mapping.date &&
      column(i).every((cell) => !cell.trim());
    const unsigned = (i: number) =>
      column(i).every((cell) => !cell.trim() || (signedMinor(cell) ?? -1) >= 0);
    if (sparse.length >= 2) {
      [mapping.debit, mapping.credit] = [sparse[0], sparse[1]];
    } else if (
      numeric.length > 0 &&
      !hasHeader &&
      unsigned(numeric[0]) &&
      blank(numeric[0] + 1)
    ) {
      // CIBC with only money out in this file: the money-in column is empty.
      [mapping.debit, mapping.credit] = [numeric[0], numeric[0] + 1];
    } else if (
      numeric.length > 0 &&
      !hasHeader &&
      unsigned(numeric[0]) &&
      blank(numeric[0] - 1) &&
      numeric[0] - 1 !== mapping.description
    ) {
      // …or only money in: the money-out column before it is empty.
      [mapping.debit, mapping.credit] = [numeric[0] - 1, numeric[0]];
    } else if (numeric.length > 0) {
      mapping.amount = numeric[0];
    } else {
      return null;
    }
  }
  if (mapping.description === -1) {
    const used = new Set([
      mapping.date,
      mapping.amount,
      mapping.debit,
      mapping.credit,
      mapping.direction,
    ]);
    const text = [...Array(width).keys()]
      .filter((i) => !used.has(i) && !numeric.includes(i))
      .map((i) => ({
        i,
        length: column(i).reduce((total, cell) => total + cell.length, 0),
      }))
      .sort((a, b) => b.length - a.length);
    if (text.length === 0) return null;
    mapping.description = text[0].i;
  }

  mapping.dateOrder =
    detectDateOrder(column(mapping.date), country)?.order ?? "dmy";
  if (options.card && mapping.amount !== null && mapping.direction === null) {
    const amounts = column(mapping.amount)
      .map(signedMinor)
      .filter((n): n is number => n !== null && n !== 0);
    mapping.invertSign =
      amounts.filter((n) => n > 0).length > amounts.length / 2;
  }
  return mapping;
}

/** FNV-1a, 64-bit, as hex. Stable across browsers; not for security. */
export function stableHash(text: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

export interface ImportedRow {
  /** 1-based line in the file, for messages. */
  line: number;
  date: IsoDate;
  description: string;
  amountMinor: number;
  kind: TransactionKind;
  categoryId: string | null;
  payee: string | null;
  importHash: string;
}

export interface ImportProblem {
  line: number;
  message: string;
}

export function readStatement(
  rows: readonly string[][],
  mapping: ColumnMapping,
  options: { accountId: string; currency: string; rules?: readonly Rule[] },
): { rows: ImportedRow[]; problems: ImportProblem[] } {
  const out: ImportedRow[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Map<string, number>();
  const start = mapping.hasHeader ? 1 : 0;

  for (let r = start; r < rows.length; r += 1) {
    const cells = rows[r];
    const line = r + 1;
    const date = parseStatementDate(
      cells[mapping.date] ?? "",
      mapping.dateOrder,
    );
    if (!date) {
      problems.push({
        line,
        message: `"${cells[mapping.date] ?? ""}" is not a date`,
      });
      continue;
    }

    let amount: number;
    try {
      if (mapping.amount !== null) {
        amount = parseAmount(
          cells[mapping.amount] ?? "",
          options.currency,
        ).minor;
      } else {
        const out = cells[mapping.debit ?? -1]?.trim()
          ? parseAmount(cells[mapping.debit!], options.currency).minor
          : 0;
        const inn = cells[mapping.credit ?? -1]?.trim()
          ? parseAmount(cells[mapping.credit!], options.currency).minor
          : 0;
        amount = Math.abs(inn) - Math.abs(out);
      }
      if (mapping.direction !== null) {
        const marker = (cells[mapping.direction] ?? "").trim().toLowerCase();
        if (/^(dr|debit|d|withdrawal)$/.test(marker))
          amount = -Math.abs(amount);
        else if (/^(cr|credit|c|deposit)$/.test(marker))
          amount = Math.abs(amount);
      }
    } catch (error) {
      problems.push({
        line,
        message:
          error instanceof MoneyError ? error.message : "Unreadable amount",
      });
      continue;
    }
    if (mapping.invertSign) amount = -amount;
    if (amount === 0) {
      problems.push({ line, message: "Zero amount — skipped" });
      continue;
    }

    const description = [
      cells[mapping.description],
      mapping.descriptionExtra !== null ? cells[mapping.descriptionExtra] : "",
    ]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, 200);
    if (!description) {
      problems.push({ line, message: "No description" });
      continue;
    }

    const identity = `${options.accountId}|${date}|${amount}|${normaliseText(description)}`;
    const nth = seen.get(identity) ?? 0;
    seen.set(identity, nth + 1);

    const rule = options.rules
      ? applyRules(options.rules, { description, accountId: options.accountId })
      : null;

    out.push({
      line,
      date,
      description,
      amountMinor: amount,
      kind: amount < 0 ? "expense" : "income",
      categoryId: rule?.categoryId ?? null,
      payee: rule?.payee ?? null,
      importHash: stableHash(`${identity}|${nth}`),
    });
  }
  return { rows: out, problems };
}

/** One imported row as the posting the ledger stores. */
export const importedPosting = (
  row: ImportedRow,
  accountId: string,
  price: { fxRate: number; baseAmountMinor: number } | null,
): Posting => ({
  accountId,
  categoryId: row.categoryId,
  amountMinor: row.amountMinor,
  fxRate: price?.fxRate ?? null,
  baseAmountMinor: price?.baseAmountMinor ?? null,
});
