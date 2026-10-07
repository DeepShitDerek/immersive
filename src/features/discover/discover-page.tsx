"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, MapPin, Plus, Trash2 } from "lucide-react";
import type {
  DiscoverPlace,
  DiscoverTopic,
  IntegrationSettings,
} from "@/types";
import {
  useDeleteDiscoverPlaceMutation,
  useDeleteDiscoverTopicMutation,
  useGetDiscoverPlacesQuery,
  useGetDiscoverTopicsQuery,
  useGetIntegrationSettingsQuery,
  useSaveDiscoverPlaceMutation,
  useSaveDiscoverTopicMutation,
} from "@/store/api/adminApi";
import { useGetMoneySettingsQuery } from "@/features/money/data/money-api";
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
import {
  LoadError,
  ModuleTabs,
  PageHeader,
  type ModuleTab,
} from "@/components/admin/shared";
import { useUrlParam } from "@/hooks/use-url-param";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { discoverPlaceSchema, discoverTopicSchema } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import {
  describeWeather,
  fetchJson,
  parseForecast,
  parsePlaces,
  placeSearchUrl,
  parseStories,
  topicUrl,
  weatherUrl,
  WINDOWS,
  type Forecast,
  type PlaceMatch,
  type Story,
  type Window,
} from "./sources";
import { MostRead, NewRepos, TopStories } from "./digest";
import { CorridorPanel, CryptoPanel, EconomyPanel } from "./market-panels";
import { Headlines } from "./headlines";
import { CareerPanel } from "./career-panel";
import { ReadingPanel } from "./reading-panel";
import { WatchlistPanel } from "./watchlist-panel";

/**
 * Discover — the parts of the day this app does not own.
 *
 * Everything here comes from a service that needs **no API key**, which is a
 * constraint the architecture imposes rather than a preference: this is a
 * static export with no server, so a key would be compiled into the bundle and
 * published with it. See `sources.ts`.
 *
 * The question it answers is "what happened while I was not looking", over the
 * window you pick. The ranking is the answer: most-discussed by score,
 * most-read by actual readership, most-starred by stars. A chronological feed
 * would be the same information with the judgement removed.
 *
 * Weather sits beside it rather than in it. Two places matter when you live
 * away from family, and whether it is dark there is what decides if you call —
 * but it is not news, so it does not compete with the digest for the column
 * that carries weight.
 *
 * Nothing fetched is stored. The rows behind this are only *what to ask for*.
 */
type Lane = "money" | "career" | "reading" | "world";

const LANES: ModuleTab<Lane>[] = [
  { id: "money", label: "Money & markets" },
  { id: "career", label: "Career" },
  { id: "reading", label: "Worth reading" },
  { id: "world", label: "What happened" },
];
const LANE_IDS = LANES.map((l) => l.id);

export default function DiscoverPage() {
  const {
    data: places = [],
    error: placesError,
    refetch: refetchPlaces,
  } = useGetDiscoverPlacesQuery();
  const {
    data: topics = [],
    error: topicsError,
    refetch: refetchTopics,
  } = useGetDiscoverTopicsQuery();
  // Your places and topics shape every lane; without them the lanes fall back
  // to defaults, which would pass for your choices unless this says otherwise.
  const listsError = placesError ?? topicsError;
  const { data: money } = useGetMoneySettingsQuery();
  const { data: integrations } = useGetIntegrationSettingsQuery();

  // In the URL (?lane=), so Back and a reload return to the same lane.
  const [laneParam, setLaneParam] = useUrlParam("lane", "replace");
  const lane: Lane = (LANE_IDS as string[]).includes(laneParam ?? "")
    ? (laneParam as Lane)
    : "money";
  const setLane = (next: Lane) => setLaneParam(next === "money" ? null : next);
  const [window, setWindow] = useState<Window>("day");

  /*
    The corridor comes from Finance, which already knows where money is earned
    and where it is sent — `home_currency` exists there precisely for this.
    Asking again here would be a second answer to a settled question, and the
    two would drift.
  */
  const base = money?.baseCurrency ?? "CAD";
  const home = money?.saved ? money.homeCurrency : null;

  return (
    <div className="space-y-5 pb-10">
      {/*
        The header and the lane switch are stacked, not sat side by side.

        They were siblings in a `flex flex-wrap` row, and `PageHeader` is a
        plain `div` with no `min-w-0` — so inside a flex parent its default
        `min-width: auto` let a long description claim the whole basis and
        squeeze the switch beside it. With two lanes that was survivable; at
        four it breaks, which is what was reported.

        Stacking also gives the switch the full width it needs. Four labels is
        more than fits beside a heading on a laptop, let alone a phone.
      */}
      <PageHeader
        title="Discover"
        description="Markets, the job market, and what happened while you were not looking."
      />

      {listsError ? (
        <div className="mb-4">
          <LoadError
            what="your places and topics"
            error={listsError}
            onRetry={() => {
              void refetchPlaces();
              void refetchTopics();
            }}
          />
        </div>
      ) : null}

      {/*
        The lanes are the module's sections, so they are its underlined tabs
        (ModuleTabs), like every other module's: a hand-rolled tablist with
        its own look sat here. The row scrolls on a phone, with an edge cue.
      */}
      <ModuleTabs
        label="Discover sections"
        tabs={LANES}
        current={lane}
        onSelect={setLane}
      />

      {lane === "money" && (
        <MoneyLane
          base={base}
          home={home}
          places={places}
          integrations={integrations}
        />
      )}

      {lane === "career" && <CareerLane />}

      {/*
        A lane of its own rather than a panel inside "What happened".
        
        Those two answer different questions: one is "what occurred", the other
        is "what is worth an hour of my attention". Ranking by engagement is
        the second question, and burying it under the first is how it stops
        being asked.
      */}
      {lane === "reading" && <ReadingPanel />}

      {lane === "world" && (
        <WorldLane topics={topics} window={window} onWindow={setWindow} />
      )}
    </div>
  );
}

/* ── Money lane ──────────────────────────────────────────────────────────── */

function MoneyLane({
  base,
  home,
  places,
  integrations,
}: {
  base: string;
  home: string | null;
  places: DiscoverPlace[];
  integrations?: IntegrationSettings;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {home ? (
          <CorridorPanel base={base} quote={home} />
        ) : (
          <section className="rounded-surface border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">
              Currency corridor
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Set a home currency in Finance and the rate you send at shows
              here, against its own last month.
            </p>
          </section>
        )}

        <CryptoPanel />
        <EconomyPanel country="CA" />
      </div>

      {/*
        The watchlist replaces the standing apology about indices. The
        constraint is the same and still true, but it is now stated *inside*
        the feature it limits — where the reader can act on it — rather than as
        a paragraph explaining why there is no feature.
      */}
      <WatchlistPanel
        baseCurrency={base}
        provider={integrations?.market_data_provider ?? null}
        apiKey={integrations?.market_data_key ?? null}
      />

      <section className="space-y-3" aria-label="Weather">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {places.map((place) => (
            <WeatherCard key={place.id} place={place} />
          ))}
          <AddPlace />
        </div>
      </section>
    </div>
  );
}

/* ── Career lane ─────────────────────────────────────────────────────────── */

function CareerLane() {
  return <CareerPanel />;
}

/* ── World lane ──────────────────────────────────────────────────────────── */

function WorldLane({
  topics,
  window,
  onWindow,
}: {
  topics: DiscoverTopic[];
  window: Window;
  onWindow: (next: Window) => void;
}) {
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Time window" className="flex gap-1">
        {WINDOWS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === window}
            onClick={() => onWindow(option.id)}
            className={cn(
              "rounded-control px-3 py-1.5 text-xs font-medium transition-[box-shadow,color] duration-base ease-enter",
              option.id === window
                ? "bg-card text-foreground shadow-e2"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Headlines />
          <TopStories window={window} />
          <NewRepos window={window} />

          <section className="space-y-3" aria-label="Following">
            {topics.map((topic) => (
              <TopicPanel key={topic.id} topic={topic} window={window} />
            ))}
            <AddTopic count={topics.length} />
          </section>
        </div>

        <MostRead window={window} />
      </div>
    </div>
  );
}

/* ── Weather ─────────────────────────────────────────────────────────────── */

function WeatherCard({ place }: { place: DiscoverPlace }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");
  const [deletePlace] = useDeleteDiscoverPlaceMutation();
  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const body = await fetchJson(
        weatherUrl(place.latitude, place.longitude, place.timezone),
      );
      if (cancelled) return;

      const parsed = parseForecast(body);
      setForecast(parsed);
      // A failed lookup is a normal path — the service may be down, or an
      // ad-blocker may have eaten the request. It is reported, not thrown.
      setState(parsed ? "done" : "failed");
    })();

    return () => {
      cancelled = true;
    };
  }, [place.latitude, place.longitude, place.timezone]);

  const remove = async () => {
    const ok = await confirm({
      title: `Remove ${place.label}?`,
      description: "Only the place goes; nothing else is affected.",
      confirmText: "Remove",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await deletePlace(place.id).unwrap();
      toast.success("Place removed");
    } catch (error) {
      toast.error("Could not remove it", {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <article className="group relative rounded-surface border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate break-words">{place.label}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${place.label}`}
          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          onClick={() => void remove()}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {state === "loading" && (
        <p className="mt-3 text-sm text-muted-foreground">Checking…</p>
      )}

      {state === "failed" && (
        <p className="mt-3 text-sm text-muted-foreground">
          No forecast right now.
        </p>
      )}

      {forecast && (
        <div className="mt-2">
          <p className="text-3xl font-semibold tabular-nums text-foreground">
            {Math.round(forecast.temperature)}°
          </p>
          <p className="mt-0.5 text-sm text-foreground">
            {describeWeather(forecast.code)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {Math.round(forecast.high)}° / {Math.round(forecast.low)}°
            {/* Whether it is dark there is the part that decides if you call. */}
            <span className="ml-2">{forecast.isDay ? "Daytime" : "Night"}</span>
          </p>
        </div>
      )}
    </article>
  );
}

/**
 * Add a place by name: type a city, pick it from
 * the matches, keep or change its name, add. It asked for latitude and
 * longitude, which nobody knows for their own city; the coordinates are
 * still there under "Enter coordinates" for a place the search cannot find.
 * The match also brings its time zone, so the forecast is in local time.
 */
function AddPlace() {
  const [savePlace, { isLoading }] = useSaveDiscoverPlaceMutation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PlaceMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<PlaceMatch | null>(null);
  const [manual, setManual] = useState(false);
  const [label, setLabel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // Search as you type, a moment after you stop.
  useEffect(() => {
    const term = query.trim();
    if (!open || chosen || manual || term.length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        const body = await fetchJson(placeSearchUrl(term));
        if (cancelled) return;
        setMatches(parsePlaces(body));
        setSearching(false);
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, chosen, manual]);

  const reset = () => {
    setOpen(false);
    setQuery("");
    setMatches([]);
    setChosen(null);
    setManual(false);
    setLabel("");
    setLatitude("");
    setLongitude("");
  };

  const submit = async () => {
    const draft = chosen
      ? {
          label: label.trim(),
          latitude: chosen.latitude,
          longitude: chosen.longitude,
          ...(chosen.timezone ? { timezone: chosen.timezone } : {}),
        }
      : {
          label: label.trim(),
          latitude: Number(latitude),
          longitude: Number(longitude),
        };

    // Checked before the write: the columns bound the label at 80 and the
    // coordinates to real ranges, and a typo would otherwise fail at Postgres
    // with nothing to say which field was wrong.
    const checked = discoverPlaceSchema.safeParse(draft);
    if (!checked.success) {
      toast.error("Check the place", {
        description: checked.error.errors[0]?.message,
      });
      return;
    }

    try {
      await savePlace(draft).unwrap();
      reset();
      toast.success("Place added");
    } catch (error) {
      toast.error("Could not add it", {
        description: getErrorMessage(error),
      });
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-32 items-center justify-center gap-2 rounded-surface border border-dashed text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground focus-ring"
      >
        <Plus className="size-4" aria-hidden />
        Add a place
      </button>
    );
  }

  const naming = chosen || manual;

  return (
    <div className="space-y-3 rounded-surface border bg-card p-4">
      {!naming && (
        <div className="space-y-1">
          <Label htmlFor="place-search" className="text-xs">
            City or town
          </Label>
          <Input
            id="place-search"
            autoFocus
            value={query}
            placeholder="Mumbai, Toronto…"
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 text-sm"
            aria-describedby="place-search-status"
          />
          <p
            id="place-search-status"
            aria-live="polite"
            className="min-h-5 text-xs text-muted-foreground"
          >
            {query.trim().length < 2
              ? ""
              : searching
                ? "Searching…"
                : matches.length === 0
                  ? "No place by that name."
                  : `${matches.length} match${matches.length === 1 ? "" : "es"}`}
          </p>
          {matches.length > 0 && (
            <ul className="divide-y rounded-control border">
              {matches.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(match);
                      setLabel(match.name);
                    }}
                    className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-secondary focus-ring"
                  >
                    <span className="font-medium">{match.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {match.where}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {naming && (
        <>
          {chosen && (
            <p className="text-xs text-muted-foreground">
              {chosen.name}
              {chosen.where && `, ${chosen.where}`}
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="place-label" className="text-xs">
              Name
            </Label>
            <Input
              id="place-label"
              autoFocus
              value={label}
              maxLength={80}
              placeholder="Home"
              onChange={(event) => setLabel(event.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </>
      )}

      {manual && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="place-lat" className="text-xs">
              Latitude
            </Label>
            <Input
              id="place-lat"
              value={latitude}
              inputMode="decimal"
              placeholder="19.0760"
              onChange={(event) => setLatitude(event.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="place-lon" className="text-xs">
              Longitude
            </Label>
            <Input
              id="place-lon"
              value={longitude}
              inputMode="decimal"
              placeholder="72.8777"
              onChange={(event) => setLongitude(event.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {naming && (
          <Button
            type="button"
            size="sm"
            disabled={isLoading}
            onClick={() => void submit()}
          >
            Add
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={reset}>
          Cancel
        </Button>
        {!manual && !chosen && (
          <button
            type="button"
            onClick={() => setManual(true)}
            className="ml-auto rounded-control text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-ring"
          >
            Enter coordinates
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Topics ──────────────────────────────────────────────────────────────── */

const SOURCE_LABEL: Record<DiscoverTopic["source"], string> = {
  hackernews: "Hacker News",
  devto: "dev.to",
};

function TopicPanel({
  topic,
  window,
}: {
  topic: DiscoverTopic;
  window: Window;
}) {
  const [stories, setStories] = useState<Story[]>([]);
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");
  const [deleteTopic] = useDeleteDiscoverTopicMutation();
  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const body = await fetchJson(topicUrl(topic.term, topic.source, window));
      if (cancelled) return;

      if (body === null) {
        setState("failed");
        return;
      }
      setStories(parseStories(body, topic.source));
      setState("done");
    })();

    return () => {
      cancelled = true;
    };
  }, [topic.term, topic.source, window]);

  const remove = async () => {
    const ok = await confirm({
      title: `Stop following “${topic.term}”?`,
      description: "Nothing else changes.",
      confirmText: "Remove",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await deleteTopic(topic.id).unwrap();
      toast.success("Topic removed");
    } catch (error) {
      toast.error("Could not remove it", {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <section className="group overflow-hidden rounded-surface border bg-card">
      <header className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
        <div className="min-w-0">
          <h2 className="truncate break-words text-sm font-semibold text-foreground">
            {topic.term}
          </h2>
          <p className="text-xs text-muted-foreground">
            {SOURCE_LABEL[topic.source]}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Stop following ${topic.term}`}
          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          onClick={() => void remove()}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </header>

      {state === "loading" && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">Reading…</p>
      )}

      {state === "failed" && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          {SOURCE_LABEL[topic.source]} did not answer. It may be down, or the
          request may have been blocked.
        </p>
      )}

      {state === "done" && stories.length === 0 && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Nothing recent on this one.
        </p>
      )}

      <ul>
        {stories.map((story) => (
          <li key={story.id}>
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-3 border-t border-border/60 px-5 py-2.5 transition-colors hover:bg-secondary/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate break-words text-sm text-foreground">
                  {story.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {story.host}
                  {typeof story.score === "number" && ` · ${story.score}`}
                </span>
              </span>
              <ExternalLink
                className="size-3 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AddTopic({ count }: { count: number }) {
  const [saveTopic, { isLoading }] = useSaveDiscoverTopicMutation();
  const [term, setTerm] = useState("");
  const [source, setSource] = useState<DiscoverTopic["source"]>("hackernews");

  const submit = async () => {
    const draft = {
      term: term.trim(),
      source,
      sort_order: count * 10,
    };

    const checked = discoverTopicSchema.safeParse(draft);
    if (!checked.success) {
      toast.error("Check the topic", {
        description: checked.error.errors[0]?.message,
      });
      return;
    }

    try {
      await saveTopic(draft).unwrap();
      setTerm("");
      toast.success("Following it");
    } catch (error) {
      toast.error("Could not follow it", {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <div className="flex flex-wrap gap-2 rounded-surface border bg-card p-3">
      <Input
        value={term}
        maxLength={80}
        placeholder="Follow a topic — postgres, rust, design…"
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
        }}
        className="h-8 min-w-40 flex-1 text-sm"
      />
      <Select
        value={source}
        onValueChange={(next) => setSource(next as DiscoverTopic["source"])}
      >
        <SelectTrigger className="h-8 w-36 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hackernews">Hacker News</SelectItem>
          <SelectItem value="devto">dev.to</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        className="h-8"
        disabled={!term.trim() || isLoading}
        onClick={() => void submit()}
      >
        Follow
      </Button>
    </div>
  );
}
