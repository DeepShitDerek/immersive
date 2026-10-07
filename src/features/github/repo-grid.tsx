"use client";

import {
  ArrowUpRight,
  CloudOff,
  FolderGit2,
  GitFork,
  Star,
} from "lucide-react";
import { useRepoList } from "./use-repo-list";
import type { GitHubRepo } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Stagger, StaggerItem } from "@/components/layout/motion";
import { safeLinkUrl } from "@/lib/safe-url";

/**
 * One repository: a mark, the name, what it does, and its numbers.
 *
 * The name left monospace — it is read as a name here, not character by
 * character — and the stats use tabular figures so a row of cards lines up.
 */
function RepoCard({ repo }: { repo: GitHubRepo }) {
  const href = safeLinkUrl(repo.html_url);
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"
        >
          <FolderGit2 className="size-4" />
        </span>
        <p
          className="min-w-0 flex-1 truncate pt-1.5 font-semibold transition-colors group-hover:text-primary"
          title={repo.name}
        >
          {repo.name}
        </p>
        {href && (
          <ArrowUpRight
            aria-hidden
            className="mt-2 size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-base ease-enter group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
          />
        )}
      </div>
      <p className="mt-3 line-clamp-2 grow text-sm leading-relaxed text-muted-foreground">
        {repo.description ?? "No description"}
      </p>
      <div className="mt-4 flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
        {repo.language && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-primary" />
            {repo.language}
          </span>
        )}
        <span className="flex items-center gap-1" title="Stars">
          <Star className="size-3.5" aria-hidden />
          {repo.stargazers_count.toLocaleString()}
        </span>
        <span className="flex items-center gap-1" title="Forks">
          <GitFork className="size-3.5" aria-hidden />
          {repo.forks_count.toLocaleString()}
        </span>
      </div>
    </>
  );

  const card =
    "group flex h-full flex-col rounded-surface bg-card p-5 shadow-e1";

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${card} transition-[box-shadow,transform] duration-base ease-enter hover:-translate-y-0.5 hover:shadow-e2 focus-ring motion-reduce:hover:translate-y-0`}
    >
      {body}
    </a>
  ) : (
    <div className={card}>{body}</div>
  );
}

/** Live GitHub repositories grid driven by profile_data.github_projects_config. */
export function RepoGrid() {
  const { state, repos, shown, more, username, perPage } = useRepoList();

  if (state === "loading") {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
        {Array.from({ length: Math.min(perPage, 6) }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-surface" />
        ))}
      </div>
    );
  }

  if (state === "hidden") return null;

  if (state === "error") {
    return (
      <div className="flex items-center gap-4 rounded-surface bg-card p-5 shadow-e1">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
        >
          <CloudOff className="size-4" />
        </span>
        <p className="text-sm text-muted-foreground">
          Repositories couldn&apos;t be loaded from GitHub right now.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {repos.slice(0, shown).map((repo) => (
          <StaggerItem key={repo.id}>
            <RepoCard repo={repo} />
          </StaggerItem>
        ))}
      </Stagger>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {shown < repos.length && (
          <Button variant="outline" className="rounded-full" onClick={more}>
            Load more
            <span className="ml-1.5 text-muted-foreground">
              {repos.length - shown}
            </span>
          </Button>
        )}
        <a
          href={`https://github.com/${encodeURIComponent(username)}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-ring"
        >
          View all on GitHub
          <ArrowUpRight
            aria-hidden
            className="size-4 transition-transform duration-base ease-enter group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </a>
      </div>
    </div>
  );
}
