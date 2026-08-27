import { useEffect } from 'react';
import type { Entry } from '@/features/analysis/nodeMap';
import type { GameNode, GameTree } from '@/lib/api';
import type { BoardAnnotations } from '@/store/room';

function lastChild(node: GameNode): GameNode {
  return node.children[0] ? lastChild(node.children[0]) : node;
}

/**
 * The board's global keyboard map: arrows/Home/End navigate, f flips, c
 * opens the comment editor, Esc clears the current node's drawings. The
 * handler lives on `window` so the keys work from anywhere on the page —
 * except while typing, while a modifier changes the meaning (browser
 * shortcuts), or while a board square has keyboard focus (the board moves
 * the focused square instead of the position, and stops propagation itself).
 */
export function useBoardKeyboard({
  tree,
  byId,
  current,
  navigate,
  canEdit,
  annotations,
  onAnnotations,
  onFlip,
  onOpenComment,
  disabled = false,
}: {
  tree: GameTree | null;
  byId: Map<number, Entry>;
  current: GameNode | null;
  navigate: (id: number) => void;
  canEdit: boolean;
  annotations: Record<number, BoardAnnotations>;
  onAnnotations?: (set: BoardAnnotations, nodeId: number) => void;
  onFlip: () => void;
  onOpenComment: () => void;
  /**
   * Suspends the map while a modal owns the keys (the historical-examples
   * dialog pages its carousel with the same arrows) — the board under the
   * dialog must not navigate.
   */
  disabled?: boolean;
}) {
  useEffect(() => {
    if (disabled || !tree || !current) {
      return;
    }
    const parent = byId.get(current.id)?.parent ?? null;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      let handled = false;
      if (event.key === 'ArrowRight' && current.children[0]) {
        navigate(current.children[0].id);
        handled = true;
      }
      if (event.key === 'ArrowLeft' && parent) {
        navigate(parent.id);
        handled = true;
      }
      if (event.key === 'Home') {
        navigate(tree.root.id);
        handled = true;
      }
      if (event.key === 'End') {
        navigate(lastChild(current).id);
        handled = true;
      }
      if (event.key === 'f' || event.key === 'F') {
        onFlip();
        handled = true;
      }
      if ((event.key === 'c' || event.key === 'C') && canEdit) {
        onOpenComment();
        handled = true;
      }
      if (event.key === 'Escape' && canEdit) {
        const drawn = annotations[current.id];
        if (drawn !== undefined && (drawn.arrows.length > 0 || drawn.highlights.length > 0)) {
          onAnnotations?.({ arrows: [], highlights: [] }, current.id);
          handled = true;
        }
      }
      if (handled) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    tree,
    byId,
    current,
    navigate,
    canEdit,
    annotations,
    onAnnotations,
    onFlip,
    onOpenComment,
    disabled,
  ]);
}
