import { describe, expect, it } from "vitest";
import { incomingEdges, outgoingEdges, searchNodes } from "../domain/selectors";
import { fromDocument } from "../domain/serialize";
import { testEnv } from "../domain/test-helpers";
import { createEditorActions } from "./actions";
import { shortcutFor, shortcutLabel } from "./keyboard";
import { createMapStore } from "./map-store";

/**
 * The brief's Definition of Done (§49), step by step, through the same
 * actions the toolbar, menu and keyboard use. Pointer-level behaviour (dragging
 * with a mouse, pan/zoom) is exercised in the browser check; everything the
 * graph must *do* is proven here.
 */
describe("Maps — Definition of Done", () => {
  it("walks the whole brief", () => {
    const store = createMapStore({ name: "Life" }, testEnv());
    const act = createEditorActions(store);
    const g = () => store.getState().graph;
    const node = (title: string) => {
      const found = Object.values(g().nodes).find((n) => n.title === title);
      if (!found) throw new Error(`no node "${title}"`);
      return found;
    };
    const selectNodes = (...titles: string[]) =>
      store.select({ nodes: titles.map((t) => node(t).id), edges: [] });

    // 1–2. A blank map; create "What's happening?".
    expect(Object.keys(g().nodes)).toHaveLength(0);
    const first = act.addNode({
      title: "What's happening?",
      type: "question",
      isRoot: true,
    });
    expect(first.editNodeId).toBeDefined();

    // 3. Add "Move Out" (Tab → child of the selection, ready to name).
    const moveOut = act.addChild();
    act.rename(moveOut.editNodeId!, "Move Out");
    // 4. "Is it required?" under "Move Out".
    selectNodes("Move Out");
    const required = act.addChild();
    act.rename(required.editNodeId!, "Is it required?");
    act.setType("decision");
    // 5. YES and NO branches.
    selectNodes("Is it required?");
    act.rename(act.addChild().editNodeId!, "YES");
    selectNodes("YES");
    act.rename(act.addSibling().editNodeId!, "NO");
    expect(incomingEdges(g(), node("NO").id)[0].source).toBe(
      node("Is it required?").id,
    );

    // 6. More nodes anywhere, including unconnected ones.
    act.addNode({ title: "Money", position: { x: 900, y: 0 } });
    act.addNode({ title: "Career", position: { x: 1200, y: 0 } });
    act.addNode({ title: "Rent", position: { x: 900, y: 400 } });

    // 7. Drag every node freely (one committed move each).
    for (const n of Object.values(g().nodes)) {
      act.move([
        { id: n.id, to: { x: n.position.x + 13, y: n.position.y - 7 } },
      ]);
    }

    // 8. Connect "Move Out" → "Money" (across branches).
    act.connect(node("Move Out").id, node("Money").id);
    // 9. Connect "Money" to another unrelated node.
    act.connect(node("Money").id, node("Rent").id);
    const moneyToRent = outgoingEdges(g(), node("Money").id)[0];
    expect(moneyToRent.target).toBe(node("Rent").id);
    // 10. Break that connection — both nodes stay.
    store.select({ nodes: [], edges: [moneyToRent.id] });
    act.deleteSelection();
    expect(g().edges[moneyToRent.id]).toBeUndefined();
    expect(node("Money")).toBeDefined();
    expect(node("Rent")).toBeDefined();

    // 11–12. Colours and types.
    selectNodes("Money", "Rent");
    act.setColor("green");
    act.setType("problem");
    expect(node("Rent")).toMatchObject({ color: "green", type: "problem" });

    // 13. Edge labels.
    const moveOutToMoney = outgoingEdges(g(), node("Move Out").id).find(
      (e) => e.target === node("Money").id,
    )!;
    act.updateEdge(moveOutToMoney.id, {
      label: "because",
      relationship: "depends_on",
    });
    expect(g().edges[moveOutToMoney.id]).toMatchObject({
      label: "because",
      relationship: "depends_on",
    });

    // 14–15. Select several nodes and move them together.
    selectNodes("YES", "NO");
    const before = { yes: node("YES").position, no: node("NO").position };
    act.move(
      store.getState().selection.nodes.map((id) => ({
        id,
        to: {
          x: g().nodes[id].position.x + 100,
          y: g().nodes[id].position.y + 50,
        },
      })),
    );
    expect(node("YES").position).toEqual({
      x: before.yes.x + 100,
      y: before.yes.y + 50,
    });
    expect(node("NO").position).toEqual({
      x: before.no.x + 100,
      y: before.no.y + 50,
    });

    // 16. Delete nodes (and only their edges).
    selectNodes("Career");
    act.deleteSelection();
    expect(Object.values(g().nodes).some((n) => n.title === "Career")).toBe(
      false,
    );

    // 17. Undo everything, then redo everything.
    const end = g();
    let steps = 0;
    while (act.undo()) steps++;
    expect(steps).toBeGreaterThan(20);
    expect(Object.keys(g().nodes)).toHaveLength(0);
    while (act.redo()) steps--;
    expect(steps).toBe(0);
    expect(Object.keys(g().nodes).sort()).toEqual(
      Object.keys(end.nodes).sort(),
    );
    expect(Object.keys(g().edges).sort()).toEqual(
      Object.keys(end.edges).sort(),
    );

    // 18. Search.
    expect(searchNodes(g(), "req").map((n) => n.title)).toEqual([
      "Is it required?",
    ]);

    // 20. Close and reopen: the saved document restores the same map.
    const reopened = fromDocument(
      JSON.parse(JSON.stringify(store.toDocument())),
    );
    expect(reopened.repairs).toEqual([]);
    expect(reopened.graph).toEqual(g());
  });

  it("guards the edges of the flow", () => {
    const store = createMapStore({}, testEnv());
    const act = createEditorActions(store);
    const a = act.addNode({ title: "A" }).editNodeId!;
    expect(act.connect(a, a).notice).toMatch(/itself/);
    const b = act.addNode({ title: "B" }).editNodeId!;
    act.connect(a, b);
    expect(act.connect(a, b).notice).toMatch(/already/);

    store.select({ nodes: [a], edges: [] });
    act.setLocked(true);
    store.select({ nodes: [a, b], edges: [] });
    expect(act.deletionImpact()).toEqual({ nodes: 1, edges: 1 });
    expect(act.deleteSelection().notice).toMatch(/locked/);
    expect(store.getState().graph.nodes[a]).toBeDefined();
    expect(store.getState().selection.nodes).toEqual([a]);

    store.select({ nodes: [a], edges: [] });
    const clip = act.copy();
    expect(act.paste(clip).notice).toBeUndefined();
    expect(Object.keys(store.getState().graph.nodes)).toHaveLength(2);
    expect(act.paste({ not: "a clip" }).notice).toBeUndefined(); // falls back to the internal copy
  });
});

describe("keyboard", () => {
  it("maps keys to actions on both platforms", () => {
    expect(shortcutFor({ key: "Tab" }, false)).toBe("addChild");
    expect(shortcutFor({ key: "Enter" }, false)).toBe("addSibling");
    expect(shortcutFor({ key: "Backspace" }, false)).toBe("delete");
    expect(shortcutFor({ key: "z", ctrlKey: true }, false)).toBe("undo");
    expect(
      shortcutFor({ key: "Z", ctrlKey: true, shiftKey: true }, false),
    ).toBe("redo");
    expect(shortcutFor({ key: "y", ctrlKey: true }, false)).toBe("redo");
    expect(shortcutFor({ key: "z", metaKey: true }, true)).toBe("undo");
    expect(shortcutFor({ key: "z", ctrlKey: true }, true)).toBeNull();
    expect(shortcutFor({ key: "f", ctrlKey: true }, false)).toBe("search");
    expect(shortcutFor({ key: "a" }, false)).toBeNull();
    expect(shortcutFor({ key: "Tab", shiftKey: true }, false)).toBeNull();
  });

  it("labels shortcuts per platform", () => {
    expect(shortcutLabel("undo", true)).toBe("⌘Z");
    expect(shortcutLabel("redo", false)).toBe("Ctrl+Shift+Z");
  });
});
