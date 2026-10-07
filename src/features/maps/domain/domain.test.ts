import { describe, expect, it } from "vitest";
import {
  addChild,
  addSibling,
  connect,
  connectFirstToRest,
  createNode,
  deleteNodes,
  disconnect,
  moveNodes,
  setColor,
  setLocked,
  setType,
  updateEdge,
  updateNode,
} from "./commands";
import { copy, duplicate, paste } from "./clipboard";
import { redo, undo, canRedo, canUndo } from "./history";
import { applyMutation } from "./mutations";
import {
  incidentEdges,
  incomingEdges,
  neighbours,
  outgoingEdges,
  searchNodes,
} from "./selectors";
import { fromDocument, toDocument, DEFAULT_SETTINGS } from "./serialize";
import { session, testEnv } from "./test-helpers";
import { EMPTY_GRAPH, GraphError, type Graph } from "./types";

const env = () => testEnv();

/** Builds: root "What's happening?" → Move Out, Career, Money. */
function lifeMap() {
  const e = env();
  const s = session();
  const root = createNode(
    s.state.graph,
    { title: "What's happening?", type: "question", isRoot: true },
    e,
  );
  s.run("root", root.mutations);
  const ids: Record<string, string> = { root: root.nodeId };
  for (const title of ["Move Out", "Career", "Money"]) {
    const child = addChild(s.state.graph, root.nodeId, { title }, e);
    s.run(`add ${title}`, child.mutations);
    ids[title] = child.nodeId;
  }
  return { s, ids, e };
}

describe("nodes", () => {
  it("creates, updates and deletes", () => {
    const { s, ids } = lifeMap();
    expect(Object.keys(s.state.graph.nodes)).toHaveLength(4);

    s.run(
      "rename",
      updateNode(s.state.graph, ids["Move Out"], { title: "Move out?" }),
    );
    expect(s.state.graph.nodes[ids["Move Out"]].title).toBe("Move out?");

    s.run("delete", deleteNodes(s.state.graph, [ids.Money]).mutations);
    expect(s.state.graph.nodes[ids.Money]).toBeUndefined();
  });

  it("an update that changes nothing records nothing", () => {
    const { s, ids } = lifeMap();
    const before = s.state.history.past.length;
    expect(
      s.run("noop", updateNode(s.state.graph, ids.Career, { title: "Career" })),
    ).toBe(false);
    expect(s.state.history.past.length).toBe(before);
  });

  it("children line up below the parent and connect from it", () => {
    const { s, ids } = lifeMap();
    const g = s.state.graph;
    const root = g.nodes[ids.root];
    const kids = ["Move Out", "Career", "Money"].map((t) => g.nodes[ids[t]]);
    for (const kid of kids)
      expect(kid.position.y).toBeGreaterThan(root.position.y);
    expect(new Set(kids.map((k) => k.position.x)).size).toBe(3);
    expect(
      outgoingEdges(g, ids.root)
        .map((e) => e.target)
        .sort(),
    ).toEqual(kids.map((k) => k.id).sort());
  });

  it("a sibling shares its node's parent and relationship", () => {
    const { s, ids, e } = lifeMap();
    s.run(
      "rel",
      updateEdge(
        s.state.graph,
        incomingEdges(s.state.graph, ids.Career)[0].id,
        { relationship: "causes" },
      ),
    );
    const sib = addSibling(s.state.graph, ids.Career, { title: "Health" }, e);
    s.run("sibling", sib.mutations);
    const [edge] = incomingEdges(s.state.graph, sib.nodeId);
    expect(edge.source).toBe(ids.root);
    expect(edge.relationship).toBe("causes");
  });

  it("a sibling of a parentless node is placed beside it, unconnected", () => {
    const e = env();
    const s = session();
    const a = createNode(EMPTY_GRAPH, { title: "A" }, e);
    s.run("a", a.mutations);
    const b = addSibling(s.state.graph, a.nodeId, {}, e);
    s.run("b", b.mutations);
    expect(Object.keys(s.state.graph.edges)).toHaveLength(0);
    expect(s.state.graph.nodes[b.nodeId].position.x).toBeGreaterThan(0);
  });

  it("new nodes never land on top of existing ones", () => {
    const e = env();
    const s = session();
    for (let i = 0; i < 5; i++) {
      s.run(
        "n",
        createNode(s.state.graph, { position: { x: 0, y: 0 } }, e).mutations,
      );
    }
    const xs = Object.values(s.state.graph.nodes).map((n) => n.position.x);
    expect(new Set(xs).size).toBe(5);
  });

  it("only one root at a time", () => {
    const { s, ids } = lifeMap();
    s.run("root", updateNode(s.state.graph, ids.Career, { isRoot: true }));
    const roots = Object.values(s.state.graph.nodes).filter((n) => n.isRoot);
    expect(roots.map((n) => n.id)).toEqual([ids.Career]);
  });

  it("colour and type apply to many nodes at once", () => {
    const { s, ids } = lifeMap();
    s.run("colour", setColor(s.state.graph, [ids.Career, ids.Money], "blue"));
    s.run("type", setType(s.state.graph, [ids.Career, ids.Money], "goal"));
    for (const id of [ids.Career, ids.Money]) {
      expect(s.state.graph.nodes[id]).toMatchObject({
        color: "blue",
        type: "goal",
      });
    }
  });

  it("locked nodes don't move and aren't deleted", () => {
    const { s, ids } = lifeMap();
    s.run("lock", setLocked(s.state.graph, [ids.root], true));
    expect(
      moveNodes(s.state.graph, [{ id: ids.root, to: { x: 999, y: 999 } }]),
    ).toEqual([]);
    const result = deleteNodes(s.state.graph, [ids.root, ids.Money]);
    expect(result.skippedLocked).toEqual([ids.root]);
    s.run("delete", result.mutations);
    expect(s.state.graph.nodes[ids.root]).toBeDefined();
    expect(s.state.graph.nodes[ids.Money]).toBeUndefined();
  });

  it("moving several nodes is one mutation", () => {
    const { s, ids } = lifeMap();
    const moves = moveNodes(s.state.graph, [
      { id: ids.Career, to: { x: 10, y: 10 } },
      { id: ids.Money, to: { x: 20, y: 20 } },
    ]);
    expect(moves).toHaveLength(1);
    s.run("move", moves);
    expect(s.state.graph.nodes[ids.Money].position).toEqual({ x: 20, y: 20 });
  });
});

describe("edges", () => {
  it("any node connects to any other, including across branches", () => {
    const { s, ids, e } = lifeMap();
    const r = connect(
      s.state.graph,
      ids["Move Out"],
      ids.Money,
      { label: "because" },
      e,
    );
    s.run("connect", r.mutations);
    expect(s.state.graph.edges[r.edgeId!]).toMatchObject({
      source: ids["Move Out"],
      target: ids.Money,
      label: "because",
      relationship: "related",
    });
  });

  it("cycles, both directions and multiple parents are valid", () => {
    const { s, ids, e } = lifeMap();
    s.run("a", connect(s.state.graph, ids.Money, ids.Career, {}, e).mutations);
    s.run("b", connect(s.state.graph, ids.Career, ids.Money, {}, e).mutations);
    s.run("c", connect(s.state.graph, ids.Money, ids.root, {}, e).mutations);
    expect(incidentEdges(s.state.graph, ids.Money)).toHaveLength(4);
    expect(
      neighbours(s.state.graph, ids.Money)
        .map((n) => n.id)
        .sort(),
    ).toEqual([ids.root, ids.Career].sort());
  });

  it("refuses self-loops and exact duplicates, allows a second relationship", () => {
    const { s, ids, e } = lifeMap();
    expect(connect(s.state.graph, ids.Money, ids.Money, {}, e).reason).toBe(
      "self",
    );
    const dup = connect(s.state.graph, ids.root, ids.Money, {}, e);
    expect(dup.reason).toBe("duplicate");
    const other = connect(
      s.state.graph,
      ids.root,
      ids.Money,
      { relationship: "causes" },
      e,
    );
    expect(other.mutations).toHaveLength(1);
  });

  it("disconnecting never deletes either node", () => {
    const { s, ids } = lifeMap();
    const edge = incomingEdges(s.state.graph, ids.Money)[0];
    s.run("disconnect", disconnect(s.state.graph, [edge.id, edge.id]));
    expect(s.state.graph.edges[edge.id]).toBeUndefined();
    expect(s.state.graph.nodes[ids.Money]).toBeDefined();
    expect(s.state.graph.nodes[ids.root]).toBeDefined();
  });

  it("deleting a node removes each of its edges exactly once", () => {
    const { s, ids, e } = lifeMap();
    s.run("x", connect(s.state.graph, ids.Money, ids.Career, {}, e).mutations);
    const result = deleteNodes(s.state.graph, [ids.Money, ids.Career]);
    // root→Money, root→Career, Money→Career: shared edge counted once.
    expect(result.edgeCount).toBe(3);
    s.run("delete", result.mutations);
    expect(Object.keys(s.state.graph.edges)).toHaveLength(1);
  });

  it("connect-selected links the first to each of the rest", () => {
    const { s, ids, e } = lifeMap();
    s.run(
      "c",
      connectFirstToRest(
        s.state.graph,
        [ids.Money, ids.Career, ids["Move Out"]],
        e,
      ),
    );
    expect(
      outgoingEdges(s.state.graph, ids.Money)
        .map((x) => x.target)
        .sort(),
    ).toEqual([ids.Career, ids["Move Out"]].sort());
  });

  it("labels and relationships are editable and removable", () => {
    const { s, ids } = lifeMap();
    const edge = incomingEdges(s.state.graph, ids.Money)[0];
    s.run(
      "label",
      updateEdge(s.state.graph, edge.id, {
        label: "because",
        relationship: "custom",
      }),
    );
    expect(s.state.graph.edges[edge.id].label).toBe("because");
    s.run("unlabel", updateEdge(s.state.graph, edge.id, { label: "" }));
    expect(s.state.graph.edges[edge.id].label).toBe("");
  });
});

describe("integrity", () => {
  it("rejects inconsistent mutations without changing the graph", () => {
    const { s, ids } = lifeMap();
    const before = s.state.graph;
    expect(() =>
      applyMutation(before, { type: "DELETE_NODE", id: ids.root }),
    ).toThrow(GraphError);
    expect(() =>
      s.run("bad", [
        { type: "UPDATE_NODE", id: ids.root, patch: { title: "changed" } },
        { type: "DELETE_NODE", id: "missing" },
      ]),
    ).toThrow(GraphError);
    expect(s.state.graph).toBe(before);
  });
});

describe("undo / redo", () => {
  it("undoes and redoes every kind of change", () => {
    const { s, ids, e } = lifeMap();
    const steps: [string, () => void][] = [
      [
        "rename",
        () =>
          s.run(
            "rename",
            updateNode(s.state.graph, ids.Career, { title: "Job" }),
          ),
      ],
      [
        "colour",
        () => s.run("colour", setColor(s.state.graph, [ids.Career], "red")),
      ],
      [
        "type",
        () => s.run("type", setType(s.state.graph, [ids.Career], "problem")),
      ],
      [
        "move",
        () =>
          s.run(
            "move",
            moveNodes(s.state.graph, [{ id: ids.Career, to: { x: 5, y: 5 } }]),
          ),
      ],
      [
        "connect",
        () =>
          s.run(
            "connect",
            connect(s.state.graph, ids.Career, ids.Money, {}, e).mutations,
          ),
      ],
      [
        "label",
        () =>
          s.run(
            "label",
            updateEdge(
              s.state.graph,
              outgoingEdges(s.state.graph, ids.Career)[0].id,
              { label: "pays" },
            ),
          ),
      ],
      [
        "lock",
        () => s.run("lock", setLocked(s.state.graph, [ids.Money], true)),
      ],
      [
        "delete",
        () =>
          s.run(
            "delete",
            deleteNodes(s.state.graph, [ids["Move Out"]]).mutations,
          ),
      ],
    ];
    const snapshots: Graph[] = [s.state.graph];
    for (const [, step] of steps) {
      step();
      snapshots.push(s.state.graph);
    }
    for (let i = steps.length; i > 0; i--) {
      const r = undo(s.state.graph, s.state.history);
      s.state.graph = r.graph;
      s.state.history = r.history;
      expect(stripTimes(s.state.graph)).toEqual(stripTimes(snapshots[i - 1]));
    }
    for (let i = 1; i <= steps.length; i++) {
      const r = redo(s.state.graph, s.state.history);
      s.state.graph = r.graph;
      s.state.history = r.history;
      expect(stripTimes(s.state.graph)).toEqual(stripTimes(snapshots[i]));
    }
  });

  it("typing merges into one step; a pause starts another", () => {
    const { s, ids } = lifeMap();
    const key = `title:${ids.Career}`;
    const before = s.state.history.past.length;
    s.run(
      "type",
      updateNode(s.state.graph, ids.Career, { title: "C" }),
      key,
      1000,
    );
    s.run(
      "type",
      updateNode(s.state.graph, ids.Career, { title: "Ca" }),
      key,
      1500,
    );
    s.run(
      "type",
      updateNode(s.state.graph, ids.Career, { title: "Car" }),
      key,
      2000,
    );
    expect(s.state.history.past.length).toBe(before + 1);
    s.run(
      "type",
      updateNode(s.state.graph, ids.Career, { title: "Cars" }),
      key,
      9000,
    );
    expect(s.state.history.past.length).toBe(before + 2);

    let r = undo(s.state.graph, s.state.history);
    r = undo(r.graph, r.history);
    expect(r.graph.nodes[ids.Career].title).toBe("Career");
  });

  it("a new edit clears the redo stack", () => {
    const { s, ids } = lifeMap();
    const r = undo(s.state.graph, s.state.history);
    s.state.graph = r.graph;
    s.state.history = r.history;
    expect(canRedo(s.state.history)).toBe(true);
    s.run("edit", updateNode(s.state.graph, ids.Career, { title: "x" }));
    expect(canRedo(s.state.history)).toBe(false);
    expect(canUndo(s.state.history)).toBe(true);
  });

  it("random edit sequences undo exactly back to the start and redo to the end", () => {
    const e = testEnv("r");
    const s = session();
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)];

    for (let i = 0; i < 300; i++) {
      const g = s.state.graph;
      const nodeIds = Object.keys(g.nodes);
      const edgeIds = Object.keys(g.edges);
      const roll = rand();
      if (nodeIds.length < 3 || roll < 0.25) {
        s.run(
          "create",
          createNode(
            g,
            { title: `n${i}`, position: { x: rand() * 900, y: rand() * 900 } },
            e,
          ).mutations,
        );
      } else if (roll < 0.4) {
        s.run(
          "child",
          addChild(g, pick(nodeIds), { title: `c${i}` }, e).mutations,
        );
      } else if (roll < 0.55) {
        s.run(
          "connect",
          connect(
            g,
            pick(nodeIds),
            pick(nodeIds),
            { relationship: pick(["related", "causes", "supports"] as const) },
            e,
          ).mutations,
        );
      } else if (roll < 0.65 && edgeIds.length) {
        s.run("disconnect", disconnect(g, [pick(edgeIds)]));
      } else if (roll < 0.75) {
        s.run(
          "update",
          updateNode(g, pick(nodeIds), {
            title: `u${i}`,
            color: pick(["red", "blue", null] as const),
          }),
        );
      } else if (roll < 0.85) {
        s.run(
          "move",
          moveNodes(g, [
            { id: pick(nodeIds), to: { x: rand() * 900, y: rand() * 900 } },
          ]),
        );
      } else if (roll < 0.9) {
        s.run("dup", duplicate(g, [pick(nodeIds), pick(nodeIds)], e).mutations);
      } else {
        s.run("delete", deleteNodes(g, [pick(nodeIds)]).mutations);
      }
    }
    const end = s.state.graph;
    expect(Object.keys(end.nodes).length).toBeGreaterThan(10);

    let g = end;
    let h = s.state.history;
    while (canUndo(h)) ({ graph: g, history: h } = undo(g, h));
    expect(g).toEqual(EMPTY_GRAPH);
    while (canRedo(h)) ({ graph: g, history: h } = redo(g, h));
    expect(stripTimes(g)).toEqual(stripTimes(end));
  });
});

describe("copy / paste / duplicate", () => {
  it("keeps edges inside the selection and drops edges leaving it", () => {
    const { s, ids, e } = lifeMap();
    s.run("x", connect(s.state.graph, ids.Career, ids.Money, {}, e).mutations);
    const clip = copy(s.state.graph, [ids.Career, ids.Money])!;
    expect(clip.nodes).toHaveLength(2);
    expect(clip.edges).toHaveLength(1); // Career→Money, not root→either

    const pasted = paste(s.state.graph, clip, {}, e);
    s.run("paste", pasted.mutations);
    const [a, b] = pasted.nodeIds;
    expect(pasted.nodeIds).not.toContain(ids.Career);
    expect(
      incidentEdges(s.state.graph, a).length +
        incidentEdges(s.state.graph, b).length,
    ).toBe(2);
    expect(
      incomingEdges(s.state.graph, a).some((edge) => edge.source === ids.root),
    ).toBe(false);
  });

  it("a duplicate is offset, unconnected to its original, and never a root or locked", () => {
    const { s, ids, e } = lifeMap();
    s.run("lock", setLocked(s.state.graph, [ids.root], true));
    const d = duplicate(s.state.graph, [ids.root], e);
    s.run("dup", d.mutations);
    const copyNode = s.state.graph.nodes[d.nodeIds[0]];
    const original = s.state.graph.nodes[ids.root];
    expect(copyNode.title).toBe(original.title);
    expect(copyNode.position).not.toEqual(original.position);
    expect(copyNode).toMatchObject({ isRoot: false, locked: false });
    expect(incidentEdges(s.state.graph, copyNode.id)).toHaveLength(0);
  });
});

describe("search", () => {
  it("ranks prefix matches above contains, accent- and case-insensitively", () => {
    const e = env();
    const s = session();
    for (const title of [
      "Monthly Expenses",
      "Emergency Fund",
      "Money",
      "Salary",
      "Débt",
      "Rent money",
    ]) {
      s.run("n", createNode(s.state.graph, { title }, e).mutations);
    }
    const found = searchNodes(s.state.graph, "mon").map((n) => n.title);
    expect(found.slice(0, 2).sort()).toEqual(["Money", "Monthly Expenses"]);
    expect(found).toContain("Rent money");
    expect(searchNodes(s.state.graph, "DEBT").map((n) => n.title)).toEqual([
      "Débt",
    ]);
    expect(searchNodes(s.state.graph, "   ")).toEqual([]);
  });
});

describe("serialize", () => {
  it("round-trips a map", () => {
    const { s } = lifeMap();
    const doc = toDocument(
      s.state.graph,
      { x: 10, y: 20, zoom: 1.5 },
      DEFAULT_SETTINGS,
    );
    const loaded = fromDocument(JSON.parse(JSON.stringify(doc)));
    expect(loaded.graph).toEqual(s.state.graph);
    expect(loaded.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
    expect(loaded.repairs).toEqual([]);
  });

  it("repairs rather than refusing a damaged document", () => {
    const loaded = fromDocument({
      schemaVersion: 1,
      nodes: [
        {
          id: "a",
          title: "A",
          type: "not-a-type",
          position: { x: 1, y: 2 },
          isRoot: true,
        },
        { id: "a", title: "dup" },
        { id: "b", title: "B", isRoot: true },
        { nope: true },
      ],
      edges: [
        { id: "e1", source: "a", target: "b", relationship: "weird" },
        { id: "e2", source: "a", target: "ghost" },
        { id: "e3", source: "b", target: "b" },
      ],
      viewport: "bad",
    });
    expect(Object.keys(loaded.graph.nodes)).toEqual(["a", "b"]);
    expect(loaded.graph.nodes.a.type).toBe("idea");
    expect(loaded.graph.edges.e1.relationship).toBe("related");
    expect(Object.keys(loaded.graph.edges)).toEqual(["e1"]);
    expect(
      Object.values(loaded.graph.nodes).filter((n) => n.isRoot),
    ).toHaveLength(1);
    expect(loaded.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(loaded.repairs.length).toBeGreaterThanOrEqual(4);
  });

  it("treats garbage as an empty map", () => {
    expect(fromDocument(null).graph).toEqual(EMPTY_GRAPH);
    expect(fromDocument("x").graph).toEqual(EMPTY_GRAPH);
  });
});

describe("performance (§47: 1,000 nodes, 2,000 edges)", () => {
  it("builds, searches, undoes and serialises a large map quickly", () => {
    const e = testEnv("p");
    const s = session();
    const started = performance.now();
    const ids: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const r = createNode(
        s.state.graph,
        {
          title: `Node ${i}`,
          position: { x: (i % 40) * 260, y: Math.floor(i / 40) * 160 },
        },
        e,
      );
      s.run("n", r.mutations);
      ids.push(r.nodeId);
    }
    for (let i = 0; i < 2000; i++) {
      // Two unique edges per node: k → k+1 and k → k+3 (wrapping).
      const k = i % 1000;
      const a = ids[k];
      const b = ids[(k + (i < 1000 ? 1 : 3)) % 1000];
      s.run(
        "e",
        connect(
          s.state.graph,
          a,
          b,
          { relationship: i % 2 ? "causes" : "related" },
          e,
        ).mutations,
      );
    }
    const build = performance.now() - started;
    expect(Object.keys(s.state.graph.edges)).toHaveLength(2000);

    const t1 = performance.now();
    searchNodes(s.state.graph, "node 99");
    expect(performance.now() - t1).toBeLessThan(50);

    const t2 = performance.now();
    s.run("delete", deleteNodes(s.state.graph, ids.slice(0, 50)).mutations);
    const r = undo(s.state.graph, s.state.history);
    expect(Object.keys(r.graph.nodes)).toHaveLength(1000);
    expect(performance.now() - t2).toBeLessThan(500);

    const t3 = performance.now();
    const json = JSON.stringify(
      toDocument(r.graph, { x: 0, y: 0, zoom: 1 }, DEFAULT_SETTINGS),
    );
    const back = fromDocument(JSON.parse(json));
    expect(Object.keys(back.graph.nodes)).toHaveLength(1000);
    expect(performance.now() - t3).toBeLessThan(1500);
    // Loose ceiling for CI machines; locally this is well under a few seconds.
    expect(build).toBeLessThan(20_000);
  });
});

function stripTimes(graph: Graph) {
  return {
    nodes: Object.fromEntries(
      Object.entries(graph.nodes).map(([id, { updatedAt: _u, ...rest }]) => [
        id,
        rest,
      ]),
    ),
    edges: graph.edges,
  };
}
