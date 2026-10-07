import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import type { BlockCommand } from "./slash-commands";

/**
 * Operations on a whole top-level block — what the block handle and its
 * keyboard shortcuts act on. A list or a quote moves as one block.
 */

export interface TopBlock {
  pos: number;
  node: PMNode;
  index: number;
}

/** The top-level block holding the selection. */
export function blockOfSelection(state: EditorState): TopBlock | null {
  const { $from } = state.selection;
  if ($from.depth === 0) {
    const node = state.doc.nodeAt($from.pos);
    return node ? { pos: $from.pos, node, index: $from.index(0) } : null;
  }
  return { pos: $from.before(1), node: $from.node(1), index: $from.index(0) };
}

function blockAt(state: EditorState, pos: number): TopBlock | null {
  const node = state.doc.nodeAt(pos);
  if (!node) return null;
  const $pos = state.doc.resolve(pos);
  if ($pos.depth !== 0) return null;
  return { pos, node, index: $pos.index(0) };
}

/** Swap a block with its neighbour. False at either end. */
export function moveBlock(
  editor: Editor,
  pos: number,
  direction: -1 | 1,
): boolean {
  const { state } = editor;
  const block = blockAt(state, pos);
  if (!block) return false;
  const { doc } = state;
  if (direction === -1 && block.index === 0) return false;
  if (direction === 1 && block.index >= doc.childCount - 1) return false;

  const tr = state.tr;
  const end = pos + block.node.nodeSize;
  let target: number;
  if (direction === -1) {
    target = pos - doc.child(block.index - 1).nodeSize;
    tr.delete(pos, end).insert(target, block.node);
  } else {
    // Once the block is gone its next neighbour starts at `pos`.
    target = pos + doc.child(block.index + 1).nodeSize;
    tr.delete(pos, end).insert(target, block.node);
  }
  tr.setSelection(TextSelection.near(tr.doc.resolve(target + 1)));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function duplicateBlock(editor: Editor, pos: number): boolean {
  const { state } = editor;
  const block = blockAt(state, pos);
  if (!block) return false;
  const end = pos + block.node.nodeSize;
  const tr = state.tr.insert(end, block.node);
  tr.setSelection(TextSelection.near(tr.doc.resolve(end + 1)));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function deleteBlock(editor: Editor, pos: number): boolean {
  const { state } = editor;
  const block = blockAt(state, pos);
  if (!block) return false;
  const end = pos + block.node.nodeSize;
  // A document must hold at least one block, so the last one becomes empty.
  const tr =
    state.doc.childCount === 1
      ? state.tr.replaceWith(pos, end, state.schema.nodes.paragraph.create())
      : state.tr.delete(pos, end);
  tr.setSelection(
    TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))),
  );
  editor.view.dispatch(tr);
  return true;
}

/** Convert a whole block — every line of a list, say — to another type. */
export function turnInto(
  editor: Editor,
  pos: number,
  command: BlockCommand,
): void {
  const block = blockAt(editor.state, pos);
  if (!block || block.node.isAtom) return;
  editor
    .chain()
    .focus()
    .setTextSelection({ from: pos + 1, to: pos + block.node.nodeSize - 1 })
    .run();
  command.run(editor);
}
