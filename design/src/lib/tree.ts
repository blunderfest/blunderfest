import type { NodeDto } from "./types";
import { squareName } from "./chess";

export interface TreeNode extends NodeDto {
  children: TreeNode[];
}

export function buildTree(nodes: NodeDto[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  for (const n of nodes) map.set(n.id, { ...n, children: [] });
  const roots: TreeNode[] = [];
  for (const n of nodes) {
    const node = map.get(n.id) as TreeNode;
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(node);
    else roots.push(node);
  }
  const sort = (list: TreeNode[]) => {
    list.sort((a, b) => a.orderIdx - b.orderIdx || a.id - b.id);
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function pathTo(nodes: NodeDto[], id: number | null): NodeDto[] {
  if (!id) return [];
  const map = new Map(nodes.map((n) => [n.id, n]));
  const path: NodeDto[] = [];
  let current = map.get(id) ?? null;
  while (current) {
    path.unshift(current);
    current = current.parentId ? (map.get(current.parentId) ?? null) : null;
  }
  return path;
}

/** Main line = follow the first child from the root. */
export function mainLine(tree: TreeNode[]): TreeNode[] {
  const line: TreeNode[] = [];
  let node = tree[0];
  while (node) {
    line.push(node);
    node = node.children[0];
  }
  return line;
}

export function lastNodeOfMainLine(tree: TreeNode[]): TreeNode | null {
  const line = mainLine(tree);
  return line.length ? line[line.length - 1] : null;
}

export function nextNode(tree: TreeNode[], nodes: NodeDto[], id: number | null): NodeDto | null {
  if (!id) return tree[0] ?? null;
  const map = new Map(buildTreeIndex(tree));
  const node = map.get(id);
  return node?.children[0] ?? null;
}

export function previousNode(nodes: NodeDto[], id: number | null): NodeDto | null {
  if (!id) return null;
  const map = new Map(nodes.map((n) => [n.id, n]));
  const node = map.get(id);
  if (!node || !node.parentId) return null;
  return map.get(node.parentId) ?? null;
}

function buildTreeIndex(tree: TreeNode[]): [number, TreeNode][] {
  const out: [number, TreeNode][] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push([n.id, n]);
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export function uciSquares(uci: string): { from: string; to: string } | null {
  if (!uci || uci.length < 4) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}

export const squareOf = squareName;
