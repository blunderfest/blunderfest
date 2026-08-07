"use client";

import { Fragment, useEffect, useRef } from "react";
import { moveLabel } from "@/lib/chess";
import type { TreeNode } from "@/lib/tree";
import { moveItem } from "@/ui/variants";

interface MoveListProps {
  tree: TreeNode[];
  currentId: number | null;
  recentIds?: number[];
  onSelect: (id: number) => void;
  cursors?: Record<number, { name: string; hue: number }[]>;
}

export function MoveList({
  tree,
  currentId,
  recentIds = [],
  onSelect,
  cursors = {},
}: MoveListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentId || !containerRef.current) return;
    const element = containerRef.current.querySelector<HTMLElement>(
      `[data-node-id="${currentId}"]`,
    );
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentId]);

  function renderToken(node: TreeNode, depth: number, forceNumber: boolean) {
    const label = moveLabel(node.ply, forceNumber);
    const presence = cursors[node.id] ?? [];
    return (
      <span key={`t-${node.id}`} className="inline-flex items-baseline">
        {label && (
          <span
            className={`mr-0.5 tnum ${depth === 0 ? "text-faint" : "text-faint/80 text-note"}`}
          >
            {label}
          </span>
        )}
        <button
          type="button"
          data-node-id={node.id}
          onClick={() => onSelect(node.id)}
          aria-current={currentId === node.id ? "true" : undefined}
          title={node.authorName ? `added by ${node.authorName}` : undefined}
          className={moveItem({
            depth: depth === 0 ? "main" : "variation",
            current: currentId === node.id,
            arrived: recentIds.includes(node.id),
          })}
        >
          {node.san}
          {node.comment && (
            <span className="ml-0.5 align-super text-[9px] text-info" aria-label="has a comment">
              &#9679;
            </span>
          )}
        </button>
        {presence.length > 0 && (
          <span className="ml-0.5 inline-flex -space-x-1 align-middle">
            {presence.slice(0, 3).map((p) => (
              <span
                key={p.name}
                title={`${p.name} is here`}
                className="h-1.5 w-1.5 rounded-full ring-1 ring-panel"
                style={{ background: `hsl(${p.hue} 70% 60%)` }}
              />
            ))}
          </span>
        )}
      </span>
    );
  }

  function renderLine(
    start: TreeNode,
    alts: TreeNode[],
    depth: number,
    forceNumber: boolean,
  ): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    let node: TreeNode | undefined = start;
    let currentAlts = alts;
    let force = forceNumber;

    while (node) {
      out.push(renderToken(node, depth, force));
      if (node.comment && depth === 0) {
        out.push(
          <span
            key={`c-${node.id}`}
            className="my-0.5 block rounded-chip border-l-2 border-info/60 bg-raised/60 px-2 py-1 text-note leading-snug text-muted"
          >
            {node.comment}
          </span>,
        );
      } else if (node.comment) {
        out.push(
          <span key={`c-${node.id}`} className="mx-0.5 text-note italic text-faint">
            {node.comment}
          </span>,
        );
      }
      for (const alt of currentAlts) {
        out.push(
          <span
            key={`v-${alt.id}`}
            className={`my-0.5 inline-block rounded-chip ${
              depth === 0
                ? "block border-l-2 border-line-strong pl-2"
                : "px-0.5"
            }`}
          >
            <span className="text-faint">(</span>
            {renderLine(alt, [], depth + 1, true)}
            <span className="text-faint">)</span>
          </span>,
        );
      }
      force = currentAlts.length > 0 || Boolean(node.comment);
      currentAlts = node.children.slice(1);
      node = node.children[0];
    }
    return out;
  }

  if (tree.length === 0)
    return (
      <div className="px-3 py-6 text-center text-note text-faint">
        No moves yet. Play one on the board — it becomes the first node of the
        variation tree.
      </div>
    );

  return (
    <div
      ref={containerRef}
      className="scroll-y h-full px-2.5 py-2 leading-[1.7]"
      aria-label="Move list with variations"
    >
      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
        {renderLine(tree[0], tree.slice(1), 0, false).map((n, i) => (
          <Fragment key={i}>{n}</Fragment>
        ))}
      </div>
    </div>
  );
}
