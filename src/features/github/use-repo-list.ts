"use client";

import { useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useGetGitHubReposQuery,
  useGetSiteIdentityQuery,
} from "@/store/api/publicApi";
import type { GitHubRepo } from "@/types";

const NO_REPOS: GitHubRepo[] = [];

/**
 * The owner's GitHub repositories, apart from how they are drawn: whether the
 * list is on, the request, and paging. The Classic grid and the immersive
 * list both call this.
 *
 * - `hidden`: switched off, or no username. Nothing is asked of GitHub.
 * - `error`: the request failed, or came back empty.
 */
export function useRepoList(): {
  state: "loading" | "hidden" | "error" | "ready";
  repos: GitHubRepo[];
  /** How many to draw now. */
  shown: number;
  /** How many more "Load more" would reveal. */
  remaining: number;
  more: () => void;
  username: string;
  perPage: number;
} {
  const { data: identity, isLoading: isIdentityLoading } =
    useGetSiteIdentityQuery();
  const config = identity?.profile_data.github_projects_config;

  const {
    data: repos = NO_REPOS,
    isLoading,
    isError,
  } = useGetGitHubReposQuery(
    config?.show && config.username
      ? {
          username: config.username,
          sort_by: config.sort_by,
          projects_per_page: config.projects_per_page,
          page: 1,
          exclude_forks: config.exclude_forks,
          exclude_archived: config.exclude_archived,
          exclude_profile_repo: config.exclude_profile_repo,
          min_stars: config.min_stars,
        }
      : skipToken,
  );

  const perPage = config?.projects_per_page ?? 6;
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const shown = visibleCount ?? perPage;

  const state =
    isLoading || isIdentityLoading || !identity
      ? "loading"
      : !config?.show || !config.username
        ? "hidden"
        : isError || repos.length === 0
          ? "error"
          : "ready";

  return {
    state,
    repos,
    shown,
    remaining: Math.max(0, repos.length - shown),
    more: () => setVisibleCount(shown + perPage),
    username: config?.username ?? "",
    perPage,
  };
}
