"use client";

import { useRef } from "react";
import { useRepoList } from "@/features/github/use-repo-list";
import { safeLinkUrl } from "@/lib/safe-url";
import { useScene } from "../motion/scroll-provider";
import { Rule, ruleScene } from "../shared/ruled";

const ACTION =
  "im-mono inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 text-foreground transition-colors duration-fast hover:border-foreground focus-ring";

/**
 * The owner's repositories as a ruled list, in the rhythm of the projects
 * above it. Whether there is a list, the request and the paging are
 * `useRepoList`, the hook the Classic grid calls.
 */
export function RepoList() {
  const ref = useRef<HTMLDivElement>(null);
  useScene(ref, ruleScene);
  const { state, repos, shown, remaining, more, username } = useRepoList();

  if (state === "hidden") return null;

  if (state === "loading") {
    return (
      <div aria-busy className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="im-rule h-20" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <p className="im-rule py-8 text-base text-muted-foreground">
        Repositories couldn&apos;t be loaded from GitHub right now.
      </p>
    );
  }

  return (
    <div ref={ref}>
      <ol>
        {repos.slice(0, shown).map((repo) => {
          const href = safeLinkUrl(repo.html_url);
          return (
            <li key={repo.id} data-row>
              <Rule />
              <div className="grid gap-x-10 gap-y-2 py-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
                <div className="min-w-0">
                  <h3 className="im-display text-2xl !leading-tight !normal-case sm:text-3xl">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-control decoration-primary decoration-2 underline-offset-[0.15em] hover:underline focus-ring"
                      >
                        {repo.name}
                      </a>
                    ) : (
                      repo.name
                    )}
                  </h3>
                  {repo.description && (
                    <p className="mt-2 max-w-prose text-base text-muted-foreground">
                      {repo.description}
                    </p>
                  )}
                </div>
                <p className="im-mono lg:pt-2 lg:text-right">
                  {repo.language && <span>{repo.language}</span>}
                  {repo.language && <span aria-hidden> · </span>}
                  <span>
                    <span aria-hidden>★ </span>
                    <span className="sr-only">Stars: </span>
                    {repo.stargazers_count.toLocaleString("en-US")}
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="im-rule flex flex-wrap items-center gap-3 pt-8">
        {remaining > 0 && (
          <button type="button" className={ACTION} onClick={more}>
            Load more
            <span className="opacity-70">{remaining}</span>
          </button>
        )}
        <a
          href={`https://github.com/${encodeURIComponent(username)}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION}
        >
          View all on GitHub
        </a>
      </div>
    </div>
  );
}
