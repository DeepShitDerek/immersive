"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  compactNumber,
  fetchJson,
  minimumScore,
  mostReadSource,
  newReposUrl,
  parseMostRead,
  parseTopArticles,
  parseRepos,
  parseStories,
  topStoriesUrl,
  type ReadArticle,
  type Repo,
  type Story,
  type Window,
} from "./sources";
import { Panel } from "./panel";

/**
 * The digest panels: what happened, in the window you asked about.
 *
 * Each panel owns its own fetch rather than the page orchestrating all three.
 * They are independent services with independent failure modes, and one being
 * down should cost you that panel and nothing else — the same rule the
 * dashboard's batch had to learn the hard way.
 */

function Row({
  href,
  title,
  meta,
  badge,
}: {
  href: string;
  title: string;
  meta?: string;
  badge?: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-baseline gap-3 border-t border-border/60 px-5 py-2.5 transition-colors hover:bg-secondary/50"
      >
        {badge}
        {/* min-w-0 so a long headline truncates rather than pushing the icon
            out of the panel; break-words so one unbroken token still wraps. */}
        <span className="min-w-0 flex-1">
          <span className="block truncate break-words text-sm text-foreground">
            {title}
          </span>
          {meta && (
            <span className="block text-xs text-muted-foreground">{meta}</span>
          )}
        </span>
        <ExternalLink
          className="size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </a>
    </li>
  );
}

/** Rank, not decoration: the order is the information. */
function Rank({ index }: { index: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "w-5 shrink-0 text-xs tabular-nums",
        index < 3 ? "font-semibold text-foreground" : "text-muted-foreground",
      )}
    >
      {index + 1}
    </span>
  );
}

export function TopStories({ window }: { window: Window }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    void (async () => {
      const body = await fetchJson(topStoriesUrl(window));
      if (cancelled) return;
      if (body === null) {
        setState("failed");
        return;
      }
      setStories(parseStories(body, "hackernews"));
      setState("done");
    })();

    return () => {
      cancelled = true;
    };
  }, [window]);

  return (
    <Panel
      flush
      title="Most discussed"
      note={`Hacker News, above ${minimumScore(window)} points`}
      state={state}
      empty={stories.length === 0}
    >
      <ul>
        {stories.map((story, index) => (
          <Row
            key={story.id}
            href={story.url}
            title={story.title}
            badge={<Rank index={index} />}
            meta={[story.host, story.score && `${story.score} points`]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </ul>
    </Panel>
  );
}

export function MostRead({ window }: { window: Window }) {
  const [articles, setArticles] = useState<ReadArticle[]>([]);
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");
  const source = mostReadSource(window);

  // Follows the window: yesterday's feed, the last seven days summed, or
  // the last full month. It ignored the window, which made the control look
  // broken: switching to a week left the whole right column unchanged.
  useEffect(() => {
    let cancelled = false;
    setState("loading");

    void (async () => {
      const { urls } = mostReadSource(window);
      const bodies = await Promise.all(urls.map((url) => fetchJson(url)));
      if (cancelled) return;
      if (bodies.every((body) => body === null)) {
        setState("failed");
        return;
      }
      setArticles(
        window === "day"
          ? parseMostRead(bodies[0], 6)
          : parseTopArticles(bodies, 6),
      );
      setState("done");
    })();

    return () => {
      cancelled = true;
    };
  }, [window]);

  return (
    <Panel
      flush
      title="What the world looked up"
      note={source.label}
      state={state}
      empty={articles.length === 0}
    >
      <ul>
        {articles.map((article, index) => (
          <Row
            key={article.title}
            href={article.url}
            title={article.title}
            badge={<Rank index={index} />}
            meta={`${compactNumber(article.views)} views`}
          />
        ))}
      </ul>
    </Panel>
  );
}

export function NewRepos({ window }: { window: Window }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    void (async () => {
      const body = await fetchJson(newReposUrl(window));
      if (cancelled) return;
      if (body === null) {
        setState("failed");
        return;
      }
      setRepos(parseRepos(body));
      setState("done");
    })();

    return () => {
      cancelled = true;
    };
  }, [window]);

  return (
    <Panel
      flush
      title="New in software"
      note="Repositories created in this window, by stars"
      state={state}
      empty={repos.length === 0}
    >
      <ul>
        {repos.map((repo) => (
          <Row
            key={repo.id}
            href={repo.url}
            title={repo.name}
            badge={
              <span className="flex w-14 shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                <Star className="size-3" aria-hidden />
                {compactNumber(repo.stars)}
              </span>
            }
            meta={[repo.language, repo.description].filter(Boolean).join(" · ")}
          />
        ))}
      </ul>
    </Panel>
  );
}
