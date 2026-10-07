import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { skipToken } from "@reduxjs/toolkit/query";

const state = vi.hoisted(() => ({
  identity: undefined as unknown,
  identityLoading: false,
  repos: undefined as unknown,
  reposLoading: false,
  isError: false,
  lastArg: undefined as unknown,
}));

vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({
    data: state.identity,
    isLoading: state.identityLoading,
  }),
  useGetGitHubReposQuery: (arg: unknown) => {
    state.lastArg = arg;
    return {
      data: state.repos,
      isLoading: state.reposLoading,
      isError: state.isError,
    };
  },
}));

import { useRepoList } from "./use-repo-list";

const config = (extra = {}) => ({
  profile_data: {
    github_projects_config: {
      username: "ada",
      show: true,
      sort_by: "updated",
      projects_per_page: 2,
      exclude_forks: true,
      exclude_archived: true,
      exclude_profile_repo: true,
      min_stars: 0,
      ...extra,
    },
  },
});
const repo = (id: number) => ({ id, name: `repo-${id}` });

afterEach(() => {
  cleanup();
  Object.assign(state, {
    identity: undefined,
    identityLoading: false,
    repos: undefined,
    reposLoading: false,
    isError: false,
    lastArg: undefined,
  });
});

describe("useRepoList", () => {
  it("is loading while the identity or the repositories are", () => {
    state.identityLoading = true;
    expect(renderHook(() => useRepoList()).result.current.state).toBe(
      "loading",
    );
    cleanup();
    state.identityLoading = false;
    state.identity = config();
    state.reposLoading = true;
    expect(renderHook(() => useRepoList()).result.current.state).toBe(
      "loading",
    );
  });

  it("is hidden, and asks GitHub nothing, when switched off or without a username", () => {
    state.identity = config({ show: false });
    expect(renderHook(() => useRepoList()).result.current.state).toBe("hidden");
    expect(state.lastArg).toBe(skipToken);
    cleanup();
    state.identity = config({ username: "" });
    expect(renderHook(() => useRepoList()).result.current.state).toBe("hidden");
    expect(state.lastArg).toBe(skipToken);
  });

  it("is an error when the request failed or returned nothing", () => {
    state.identity = config();
    state.isError = true;
    expect(renderHook(() => useRepoList()).result.current.state).toBe("error");
    cleanup();
    state.isError = false;
    state.repos = [];
    expect(renderHook(() => useRepoList()).result.current.state).toBe("error");
  });

  it("pages through the repositories the owner's page size at a time", () => {
    state.identity = config();
    state.repos = [repo(1), repo(2), repo(3)];
    const { result } = renderHook(() => useRepoList());
    expect(result.current).toMatchObject({
      state: "ready",
      username: "ada",
      perPage: 2,
      shown: 2,
      remaining: 1,
    });
    expect(state.lastArg).toMatchObject({ username: "ada", page: 1 });
    act(() => result.current.more());
    expect(result.current.shown).toBe(4);
    expect(result.current.remaining).toBe(0);
  });
});
