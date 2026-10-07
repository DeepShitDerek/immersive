"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
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
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/utils";
import { yearOf } from "../domain/dates";
import { convert, money, MoneyError, parseAmount } from "../domain/money";
import {
  fhsaRoom,
  flowsByYear,
  registeredMovements,
  ROOM_REGISTRATIONS,
  type RoomRegistration,
  type RoomStatus,
  rrspRoom,
  tfsaRoom,
} from "../domain/room";
import { useDeleteRoomMutation, useSaveRoomMutation } from "../data/money-api";
import { Amount } from "./amount";
import { useMoney } from "./money-context";

const NAME: Record<RoomRegistration, string> = {
  tfsa: "TFSA",
  fhsa: "FHSA",
  rrsp: "RRSP",
};
const WHERE: Record<RoomRegistration, string> = {
  tfsa: "CRA My Account → RRSP and TFSA → TFSA contribution room on 1 January",
  fhsa: "CRA My Account → FHSA → participation room",
  rrsp: "your Notice of Assessment → RRSP deduction limit",
};
const BASIS: Record<RoomStatus["basis"], string> = {
  cra: "from the CRA",
  carried: "carried forward from a CRA figure",
  estimated: "estimated",
  unknown: "not known yet",
};

/**
 * How much more can go into each tax-sheltered account this year,
 * from the CRA's figure and the deposits and withdrawals in the ledger.
 */
export function RoomPanel() {
  const {
    accounts,
    transactions,
    room,
    settings,
    incomeSources,
    rateTable,
    today,
  } = useMoney();
  const [save] = useSaveRoomMutation();
  const [remove] = useDeleteRoomMutation();
  const year = yearOf(today);
  const [registration, setRegistration] = useState<RoomRegistration>("tfsa");
  const [entryYear, setEntryYear] = useState(String(year));
  const [amount, setAmount] = useState("");

  const statuses = useMemo(() => {
    const flowsFor = (r: RoomRegistration) => {
      const { movements, unconverted } = registeredMovements(
        r,
        accounts,
        transactions,
        settings.baseCurrency,
      );
      return { flows: flowsByYear(movements), unconverted };
    };
    const tfsa = flowsFor("tfsa");
    const fhsa = flowsFor("fhsa");
    const rrsp = flowsFor("rrsp");
    const fhsaOpened =
      accounts
        .filter((a) => a.registration === "fhsa")
        .map((a) => a.openingDate)
        .sort()[0] ?? null;
    let earned = 0;
    for (const s of incomeSources) {
      if (
        s.country !== "CA" ||
        (s.endDate && s.endDate < `${year}-01-01`) ||
        s.startDate > today
      )
        continue;
      const q =
        s.currency === "CAD"
          ? { rate: 1 }
          : rateTable.quote(s.currency, "CAD", today);
      if (q)
        earned +=
          s.currency === "CAD"
            ? s.grossAnnualMinor
            : convert(money(s.grossAnnualMinor, s.currency), q.rate, "CAD")
                .minor;
    }
    return [
      {
        status: tfsaRoom(
          year,
          room,
          tfsa.flows,
          settings.residentSince,
          settings.birthYear,
        ),
        unconverted: tfsa.unconverted,
        extra: null,
      },
      {
        status: fhsaRoom(year, room, fhsa.flows, fhsaOpened),
        unconverted: fhsa.unconverted,
        extra: null,
      },
      (() => {
        const r = rrspRoom(year, room, rrsp.flows, earned);
        return {
          status: r as RoomStatus,
          unconverted: rrsp.unconverted,
          extra: earned > 0 ? r.nextYearNewRoomMinor : null,
        };
      })(),
    ];
  }, [
    accounts,
    transactions,
    room,
    settings.baseCurrency,
    settings.residentSince,
    settings.birthYear,
    incomeSources,
    rateTable,
    today,
    year,
  ]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const y = Number(entryYear);
    if (!Number.isInteger(y) || y < 2009 || y > year + 1)
      return toast.error(`Choose a year from 2009 to ${year + 1}.`);
    let roomMinor: number;
    try {
      roomMinor = parseAmount(amount, "CAD").minor;
    } catch (error) {
      return toast.error(
        error instanceof MoneyError ? error.message : "Unreadable amount.",
      );
    }
    if (Math.abs(roomMinor) > 100_000_000)
      return toast.error("That is more room than the CRA gives anyone.");
    try {
      await save({ registration, year: y, roomMinor, notes: null }).unwrap();
      setAmount("");
      toast.success(`${NAME[registration]} room for ${y} saved`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {statuses.map(({ status, unconverted, extra }) => (
          <section
            key={status.registration}
            aria-label={`${NAME[status.registration]} room`}
            className="rounded-surface border bg-card p-5 text-sm"
          >
            <h3 className="font-heading text-base font-semibold">
              {NAME[status.registration]}
            </h3>
            <p className="text-xs text-muted-foreground">
              {status.year} · {BASIS[status.basis]}
            </p>
            {status.basis === "unknown" && status.contributedMinor === 0 ? (
              <p className="mt-3 text-muted-foreground">{status.notes[0]}</p>
            ) : (
              <>
                <p
                  className={cn(
                    "mt-3 text-2xl font-semibold tabular-nums",
                    status.availableMinor < 0 && "text-destructive",
                  )}
                >
                  <Amount minor={status.availableMinor} currency="CAD" />
                </p>
                <p className="text-xs text-muted-foreground">
                  {status.availableMinor < 0
                    ? "over the limit — the CRA charges 1% a month on the excess"
                    : "can still go in this year"}
                </p>
                <dl className="mt-3 space-y-1">
                  <Row label="Room on 1 January">
                    <Amount minor={status.startMinor} currency="CAD" />
                  </Row>
                  <Row label="Put in this year">
                    <Amount minor={status.contributedMinor} currency="CAD" />
                  </Row>
                  <Row label="Taken out this year">
                    <Amount minor={status.withdrawnMinor} currency="CAD" />
                  </Row>
                </dl>
                {status.restoresNextYearMinor > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <Amount
                      minor={status.restoresNextYearMinor}
                      currency="CAD"
                    />{" "}
                    taken out comes back as room on 1 January — not before.
                  </p>
                )}
                {status.notes.map((n) => (
                  <p key={n} className="mt-2 text-xs text-muted-foreground">
                    {n}
                  </p>
                ))}
              </>
            )}
            {extra !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                This year&apos;s pay adds about{" "}
                <Amount minor={extra} currency="CAD" /> of RRSP room next year
                (18%, up to the limit).
              </p>
            )}
            {unconverted > 0 && (
              <p className="mt-2 text-xs text-warning">
                {unconverted} movement(s) in another currency could not be
                counted.
              </p>
            )}
          </section>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Counted from transfers into and out of accounts marked TFSA, FHSA or
        RRSP. Growth inside the account never uses room. The CRA&apos;s figure
        lags a few weeks behind — when they differ, theirs is the one that
        counts.
      </p>

      <section
        aria-labelledby="room-entry-heading"
        className="space-y-3 rounded-surface border bg-card p-5"
      >
        <h3
          id="room-entry-heading"
          className="font-heading text-base font-semibold"
        >
          The CRA&apos;s figure
        </h3>
        <p className="text-sm text-muted-foreground">
          Where to find it: {WHERE[registration]}.
        </p>
        <form
          onSubmit={submit}
          className="flex flex-wrap items-end gap-3"
          noValidate
        >
          <div className="space-y-1">
            <Label htmlFor="room-registration" className="text-xs">
              Account
            </Label>
            <Select
              value={registration}
              onValueChange={(v) => setRegistration(v as RoomRegistration)}
            >
              <SelectTrigger id="room-registration" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_REGISTRATIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {NAME[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="room-year" className="text-xs">
              Room on 1 January of
            </Label>
            <Input
              id="room-year"
              inputMode="numeric"
              value={entryYear}
              onChange={(e) => setEntryYear(e.target.value)}
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="room-amount" className="text-xs">
              Amount (CAD)
            </Label>
            <Input
              id="room-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-36"
            />
          </div>
          <Button type="submit" variant="outline">
            Save
          </Button>
        </form>
        {room.length > 0 && (
          <ul className="divide-y text-sm">
            {[...room]
              .sort(
                (a, b) =>
                  b.year - a.year ||
                  a.registration.localeCompare(b.registration),
              )
              .map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <span className="w-16 font-medium">
                    {NAME[r.registration]}
                  </span>
                  <span className="w-16 tabular-nums text-muted-foreground">
                    {r.year}
                  </span>
                  <Amount
                    minor={r.roomMinor}
                    currency="CAD"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${NAME[r.registration]} ${r.year}`}
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
