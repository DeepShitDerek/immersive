import type { Env } from "./commands";
import { execute, EMPTY_HISTORY, type History } from "./history";
import type { GraphMutation } from "./mutations";
import { EMPTY_GRAPH, type Graph } from "./types";

/** Deterministic ids and time, so tests can assert exact graphs. */
export function testEnv(prefix = "id"): Env {
  let n = 0;
  return {
    id: () => `${prefix}${++n}`,
    now: () => "2026-09-24T00:00:00.000Z",
  };
}

/** A tiny harness: a graph + history you can push commands through. */
export function session(graph: Graph = EMPTY_GRAPH) {
  const state: { graph: Graph; history: History } = {
    graph,
    history: EMPTY_HISTORY,
  };
  return {
    state,
    run(
      label: string,
      mutations: GraphMutation[],
      mergeKey?: string,
      at?: number,
    ) {
      const result = execute(state.graph, state.history, label, mutations, {
        mergeKey,
        at,
        now: "2026-09-24T00:00:00.000Z",
      });
      state.graph = result.graph;
      state.history = result.history;
      return result.changed;
    },
  };
}
