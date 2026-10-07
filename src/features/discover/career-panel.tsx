"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, ExternalLink, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  fetchPostings,
  filterPostings,
  postedLabel,
  skillDemand,
  type Posting,
} from "./live";
import {
  filterJobs,
  JOB_SOURCES,
  type EmploymentType,
  type Region,
} from "./jobs";

const EMPLOYMENT_FILTERS: { id: EmploymentType; label: string }[] = [
  { id: "full-time", label: "Full-time" },
  { id: "part-time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "freelance", label: "Freelance" },
];

const REGION_FILTERS: { id: Region; label: string }[] = [
  { id: "north-america", label: "North America" },
  { id: "remote", label: "Remote" },
  { id: "europe", label: "Europe" },
];

/**
 * One labelled row of chips, scrolling sideways rather than wrapping.
 *
 * The two sets were previously one wrapping row separated by a hairline. Two
 * problems: at a narrow width the divider could wrap onto a line of its own,
 * and an unlabelled separator does not say what either group *is* — "Contract"
 * and "Remote" sitting together read as one list of seven unrelated filters.
 *
 * Scrolling rather than wrapping also keeps the panel's header a fixed height,
 * so selecting a filter cannot shift the list underneath the pointer.
 */
function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-11 shrink-0 text-micro font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

function FilterToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-micro font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/**
 * What the market is hiring for, and what it is asking you to know.
 *
 * The previous version was broken in a way that looked fine, which is the
 * worst kind. It searched Remotive, whose `search` parameter is silently
 * ignored: "react" and "data engineer" returned the identical seventeen jobs,
 * top result "Patient Care Specialist". Every listing was irrelevant and every
 * skill count was computed over that same unfiltered handful, so the bar chart
 * was noise in the shape of an answer.
 *
 * This fetches a real board — around 175 live postings in one request — and
 * filters in the browser, where the matching is at least inspectable. The two
 * halves answer different questions and use different samples on purpose:
 *
 * - **Skills** are counted across the *whole* board. That is a market signal.
 *   Counting them inside a six-result search gives every skill a count of one.
 * - **Roles** are the filtered subset, because that is what you asked for.
 *
 * Both say how many postings they are built from. A count without its sample
 * is not a fact.
 */
export function CareerPanel() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");
  const [query, setQuery] = useState("");
  /**
   * The two axes that decide whether a posting is worth reading. Empty means
   * "no opinion", not "nothing" — the other reading empties the page the
   * moment you clear a filter, which looks like a broken fetch.
   */
  const [types, setTypes] = useState<EmploymentType[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await fetchPostings();
      if (cancelled) return;

      if (result === null) {
        setState("failed");
        return;
      }
      setPostings(result);
      setState("done");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filtering is cheap and local, so it runs as you type — unlike the upstream
  // search it replaced, which cost a request and returned the same thing.
  const matches = useMemo(
    () => filterJobs(filterPostings(postings, query), { types, regions }),
    [postings, query, types, regions],
  );

  const market = useMemo(() => skillDemand(postings, 12), [postings]);
  const top = market.skills[0]?.count ?? 1;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="overflow-hidden rounded-surface border bg-card">
        <header className="space-y-3 px-5 pb-3 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Open roles
            </h2>
            <p className="text-micro text-muted-foreground">
              {state === "done"
                ? `${matches.length} of ${postings.length} postings`
                : "Two boards"}
            </p>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              maxLength={80}
              placeholder="Filter by role, skill or company…"
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>

          {/*
            Terms and region, because "career" was one German board and those
            are the two things that decide whether a posting is even readable
            from Ontario. Both are inferred from free text — neither board has
            a structured field — so a posting that matches nothing stays
            visible rather than being guessed into a bucket.
          */}
          <div className="space-y-1.5">
            <FilterRow label="Terms">
              {EMPLOYMENT_FILTERS.map((option) => (
                <FilterToggle
                  key={option.id}
                  label={option.label}
                  active={types.includes(option.id)}
                  onToggle={() =>
                    setTypes((current) =>
                      current.includes(option.id)
                        ? current.filter((entry) => entry !== option.id)
                        : [...current, option.id],
                    )
                  }
                />
              ))}
            </FilterRow>

            <FilterRow label="Where">
              {REGION_FILTERS.map((option) => (
                <FilterToggle
                  key={option.id}
                  label={option.label}
                  active={regions.includes(option.id)}
                  onToggle={() =>
                    setRegions((current) =>
                      current.includes(option.id)
                        ? current.filter((entry) => entry !== option.id)
                        : [...current, option.id],
                    )
                  }
                />
              ))}
            </FilterRow>
          </div>
        </header>

        {state === "loading" && (
          <p className="px-5 pb-4 text-sm text-muted-foreground">Reading…</p>
        )}

        {state === "failed" && (
          <p className="px-5 pb-4 text-sm text-muted-foreground">
            The job board did not answer just now.
          </p>
        )}

        {state === "done" && matches.length === 0 && (
          <p className="px-5 pb-4 text-sm text-muted-foreground">
            {/* Says which corpus came up empty, so the answer is actionable
                rather than just discouraging. */}
            Nothing on this board matches “{query}”. Try a single word, or a
            skill rather than a job title.
          </p>
        )}

        <ul>
          {matches.slice(0, 12).map((posting) => (
            <li key={posting.id}>
              <a
                href={posting.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-baseline gap-3 border-t border-border/60 px-5 py-2.5 transition-colors hover:bg-secondary/50"
              >
                <Briefcase
                  className="size-3.5 shrink-0 self-center text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate break-words text-sm text-foreground">
                    {posting.title}
                  </span>
                  <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {posting.company}
                    {posting.location && (
                      <>
                        <MapPin className="size-3 shrink-0" aria-hidden />
                        {posting.location}
                      </>
                    )}
                    {posting.remote && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-micro text-secondary-foreground">
                        remote
                      </span>
                    )}
                    {posting.postedAt && ` · ${postedLabel(posting.postedAt)}`}
                  </span>
                </span>
                <ExternalLink
                  className="size-3 shrink-0 self-center text-muted-foreground"
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>

        {state === "done" && matches.length > 12 && (
          <p className="border-t border-border/60 px-5 py-2 text-micro text-muted-foreground">
            Showing 12 of {matches.length}. Narrow the filter to see the rest.
          </p>
        )}

        {/*
          Attribution is a requirement here, not a courtesy. Remote OK's API
          terms ask for a named, *followed* link back and say access is
          suspended without it — hence no `nofollow` on that one, which is the
          opposite of the usual instinct for an outbound link.
        */}
        <p className="border-t border-border/60 px-5 py-2 text-micro text-muted-foreground">
          Postings from{" "}
          <a
            href={JOB_SOURCES.remoteok.credit.href}
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {JOB_SOURCES.remoteok.credit.text}
          </a>{" "}
          and{" "}
          <a
            href={JOB_SOURCES.arbeitnow.credit.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {JOB_SOURCES.arbeitnow.credit.text}
          </a>
          .
        </p>
      </section>

      <aside className="h-fit rounded-surface border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">
          Most asked for
        </h2>
        <p className="mt-0.5 text-micro text-muted-foreground">
          {/* The sample, always. "TypeScript, 12" means nothing without it. */}
          Across all {market.sampled} postings on the board
        </p>

        {market.skills.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No skills tagged yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {market.skills.map((skill) => {
              // Highlights what you are already looking at, so the chart
              // answers "where does my thing sit" and not only "what is hot".
              const active =
                query.trim() !== "" &&
                skill.tag.includes(query.trim().toLowerCase());

              return (
                <div key={skill.tag} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuery(skill.tag)}
                    className={cn(
                      "w-24 shrink-0 truncate text-left text-xs transition-colors hover:text-foreground",
                      active
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {skill.tag}
                  </button>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500 ease-enter",
                        active ? "bg-chart-2" : "bg-primary",
                      )}
                      // Relative to the most-demanded skill, so the bars fill
                      // the width whatever the absolute counts are.
                      style={{ width: `${(skill.count / top) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-micro tabular-nums text-muted-foreground">
                    {skill.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-micro text-muted-foreground">
          One board, weighted towards European and remote roles. A signal, not a
          census.
        </p>
      </aside>
    </div>
  );
}
