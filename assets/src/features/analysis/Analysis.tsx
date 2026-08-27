import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DRAW_COLORS, kingInCheckSquare, pieceSrc } from '@/components/board';
import AnalysisSidebar from '@/features/analysis/AnalysisSidebar';
import BoardColumn from '@/features/analysis/BoardColumn';
import CommentPopup from '@/features/analysis/CommentPopup';
import type { ChessEngine } from '@/features/analysis/engine';
import { bestMoveSans } from '@/features/analysis/evalMarks';
import { endgameStart } from '@/features/analysis/gamePhases';
import { legalMovesFor, uciLineToMoves } from '@/features/analysis/legalMoves';
import { capturesOf } from '@/features/analysis/MaterialFlow';
import { buildRows } from '@/features/analysis/moveList';
import { buildNodeMap } from '@/features/analysis/nodeMap';
import {
  classifyOpening,
  loadOpeningBook,
  type OpeningBook,
  openingExitPly,
} from '@/features/analysis/openings';
import TimelineBand from '@/features/analysis/TimelineBand';
import { useBoardKeyboard } from '@/features/analysis/useBoardKeyboard';
import { useCursor } from '@/features/analysis/useCursor';
import { useDragFlag } from '@/features/analysis/useDragFlag';
import { useEngine } from '@/features/analysis/useEngine';
import { usePositionEditor } from '@/features/analysis/usePositionEditor';
import HistoricalEvidenceDialog from '@/features/historicalEvidence/HistoricalEvidenceDialog';
import {
  planFromResolvedMoves,
  planHistoricalVariation,
} from '@/features/historicalEvidence/variationPlan';
import type { GameNode, GameTree, LegalMove } from '@/lib/api';
import type {
  AddLineOp,
  AnalysisEval,
  AnalysisPosition,
  CommentAtPlyOp,
  MoveAtPlyOp,
  SetNagsOp,
  SetPositionOp,
} from '@/protocol/ops';
import { type BoardAnnotations, setupPlyFromFen } from '@/store/room';

/**
 * The analysis screen's orchestrator: every piece of viewer state, all
 * derived data and every interaction handler live here; the regions
 * (BoardColumn, AnalysisSidebar, TimelineBand) are pure presentation
 * receiving them as props. The split keeps each region readable without
 * introducing a context — the board/sidebar share almost all state, so a
 * provider would re-render everything on every eval tick anyway.
 */
export default function Analysis({
  tree,
  presenterId = null,
  selfId = null,
  presenterCursorId = null,
  following = false,
  canEdit = false,
  engine = undefined,
  lastPlayedId = null,
  remoteLastPlayedId = null,
  onFollowChange,
  onCursorChange,
  onLocalCursor,
  onPlayMove,
  onComment,
  onSetPosition,
  onAddLine,
  onSetNags,
  annotations = {},
  onAnnotations,
  onAnalyze,
  analyzing = null,
  analysis = null,
  startAtRoot = false,
  initialNodeId = null,
  onAddHistoricalGame,
  addedEvidenceGids = new Set(),
}: {
  tree: GameTree | null;
  presenterId?: string | null;
  selfId?: string | null;
  presenterCursorId?: number | null;
  following?: boolean;
  canEdit?: boolean;
  engine?: ChessEngine | null;
  lastPlayedId?: number | null;
  /**
   * The most recent move/setup node played by ANOTHER member (null for the
   * viewer's own plays): follow-the-tail reacts to this one only, so your
   * own variation inserts never yank the cursor off the viewed position.
   */
  remoteLastPlayedId?: number | null;
  onFollowChange?: (following: boolean) => void;
  onCursorChange?: (nodeId: number) => void;
  /**
   * Fires on every local cursor change (navigation, the opening position,
   * follow-tail, rollbacks) — the room view persists it per game, so
   * switching games and back restores the viewed position.
   */
  onLocalCursor?: (nodeId: number) => void;
  onPlayMove?: (payload: Omit<MoveAtPlyOp['payload'], 'game_id'>, onError?: () => void) => void;
  onComment?: (payload: Omit<CommentAtPlyOp['payload'], 'game_id'>) => void;
  onSetPosition?: (
    payload: Omit<SetPositionOp['payload'], 'game_id'>,
    onError?: () => void,
  ) => void;
  /** Insert an engine line as a variation under the viewed node (editors). */
  onAddLine?: (payload: Omit<AddLineOp['payload'], 'game_id'>) => void;
  /** Set a node's NAGs (quality glyphs), full replace (editors). */
  onSetNags?: (payload: Omit<SetNagsOp['payload'], 'game_id'>) => void;
  /** Board drawings for the active game, keyed by node id. */
  annotations?: Record<number, BoardAnnotations>;
  onAnnotations?: (set: BoardAnnotations, nodeId: number) => void;
  /** Request a whole-game engine analysis (editors; omitted otherwise). */
  onAnalyze?: (positions: AnalysisPosition[]) => void;
  /** Live progress of a running job, when this game is being analyzed. */
  analyzing?: { done: number; total: number } | null;
  /** Mainline evals from the latest completed analysis (ADR-0009). */
  analysis?: AnalysisEval[] | null;
  /** Open on the initial position instead of the tail (fresh imports). */
  startAtRoot?: boolean;
  /**
   * The node to open on when the tree arrives untouched — an added
   * historical game opens at the candidate's move.
   */
  initialNodeId?: number | null;
  /** Add a historical game to the room as another game, cursor at `ply`. */
  onAddHistoricalGame?: (tree: GameTree, ply: number, gid: number) => void;
  /**
   * Corpus game ids already in the room — the Examples dialog shows
   * "Added ✓" for them without another round trip.
   */
  addedEvidenceGids?: ReadonlySet<number>;
}) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  /** The Reference row under the pointer — its move previews as a ghost arrow. */
  const [referenceGhost, setReferenceGhost] = useState<LegalMove | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  /**
   * The historical-examples browser's captured request (ADR-0030): set on
   * open, frozen while the dialog is up, so the query never re-runs if
   * the cursor moves under the modal (another member's play).
   */
  const [evidenceDialog, setEvidenceDialog] = useState<{
    fen: string;
    route: string[] | null;
    refPly: number | null;
  } | null>(null);
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  // Per-viewer engine display toggles; persisted — analysis is a local aid,
  // never shared state.
  const [engineOn, setEngineOn] = useState(
    () => localStorage.getItem('blunderfest.engine') !== 'off',
  );
  const [arrowsOn, setArrowsOn] = useState(
    () => localStorage.getItem('blunderfest.hints') !== 'off',
  );
  /** How many MultiPV lines the engine reports (1–5, persisted). */
  const [engineLines, setEngineLines] = useState(() => {
    const stored = Number(localStorage.getItem('blunderfest.engineLines'));
    return stored >= 1 && stored <= 5 ? stored : 3;
  });

  function setEngineLinesCount(count: number) {
    setEngineLines(count);
    localStorage.setItem('blunderfest.engineLines', String(count));
  }

  function toggleEngine() {
    setEngineOn((on) => {
      localStorage.setItem('blunderfest.engine', on ? 'off' : 'on');
      return !on;
    });
  }

  function toggleArrows() {
    setArrowsOn((on) => {
      localStorage.setItem('blunderfest.hints', on ? 'off' : 'on');
      return !on;
    });
  }

  const amPresenter = selfId !== null && selfId === presenterId;

  const byId = useMemo(() => buildNodeMap(tree), [tree]);

  // The opening book loads once per session; the name follows the viewed line.
  const [book, setBook] = useState<OpeningBook | null>(null);
  useEffect(() => {
    let mounted = true;
    void loadOpeningBook().then((loaded) => {
      if (mounted) {
        setBook(loaded);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const { current, navigate, maxNodeId, addPending, rollbackPending } = useCursor({
    tree,
    byId,
    following,
    presenterCursorId,
    lastPlayedId,
    followPlayedId: remoteLastPlayedId,
    amPresenter,
    startAtRoot,
    initialNodeId,
    onCursorChange,
    onLocalCursor,
    onFollowChange,
  });

  /** The opening of the viewed line, once the book has loaded. */
  const opening = useMemo(
    () => (book === null ? null : classifyOpening(book, byId, current)),
    [book, byId, current],
  );

  /** The mainline ids (first-child chain), for off-mainline detection. */
  const mainlineIds = useMemo(() => {
    const ids = new Set<number>();
    let node = tree?.root ?? null;
    while (node !== null) {
      ids.add(node.id);
      node = node.children[0] ?? null;
    }
    return ids;
  }, [tree]);

  /**
   * When the viewed node sits inside a variation: the path from the branch
   * point down to it (and the branch's node id, for a one-click return).
   * Null on the mainline.
   */
  const linePath = useMemo(() => {
    if (current === null || mainlineIds.has(current.id)) {
      return null;
    }
    const nodes: GameNode[] = [];
    let entry = byId.get(current.id);
    let branchId: number | null = null;
    while (entry !== undefined && entry.parent !== null) {
      nodes.push(entry.node);
      if (mainlineIds.has(entry.parent.id)) {
        branchId = entry.parent.id;
        break;
      }
      entry = byId.get(entry.parent.id);
    }
    nodes.reverse();
    // No mainline ancestor found — the node isn't in the map (a pending
    // move before its echo): there's no line to describe yet.
    if (branchId === null) {
      return null;
    }
    return { nodes, branchId };
  }, [current, byId, mainlineIds]);

  /** The breadcrumb text: the last three moves of the path, numbered. */
  const linePathText = useMemo(() => {
    if (linePath === null) {
      return null;
    }
    const shown = linePath.nodes.slice(-3);
    const parts = shown.map((node, index) => {
      const san = node.san ?? t('analysis.setupNode');
      const number = Math.ceil(node.ply / 2);
      if (index === 0) {
        return `${number}${node.ply % 2 === 1 ? '.' : '...'} ${san}`;
      }
      return node.ply % 2 === 1 ? `${number}. ${san}` : san;
    });
    return `${linePath.nodes.length > 3 ? '… ' : ''}${parts.join(' ')}`;
  }, [linePath, t]);

  /**
   * The SAN path from the game start to the cursor position (for the
   * historical-evidence route). Null when the path crosses a setup node or
   * the cursor is at the root — the analysis then runs on a bare FEN.
   */
  const routeToCurrent = useMemo(() => {
    if (current === null || current.ply === 0) {
      return null;
    }
    const sans: string[] = [];
    let node: GameNode = current;
    while (true) {
      const entry = byId.get(node.id);
      const parent = entry?.parent ?? null;
      if (parent === null) {
        break;
      }
      if (node.san === null) {
        return null;
      }
      sans.unshift(node.san);
      node = parent;
    }
    return sans;
  }, [current, byId]);

  /** The mainline ply where the game leaves the opening book (chart marker). */
  const bookExitPly = useMemo(
    () => (book === null || tree === null ? null : openingExitPly(book, tree.root)),
    [book, tree],
  );

  /** Phase shading and capture markers for the eval chart. */
  const endgamePly = useMemo(() => (tree === null ? null : endgameStart(tree.root)), [tree]);
  const captures = useMemo(() => (tree === null ? [] : capturesOf(tree.root)), [tree]);

  /** The game's opening (the mainline's), for the Report header. */
  const mainlineOpening = useMemo(() => {
    if (book === null || tree === null) {
      return null;
    }
    let tip = tree.root;
    while (tip.children[0] !== undefined) {
      tip = tip.children[0];
    }
    return classifyOpening(book, byId, tip);
  }, [book, tree, byId]);

  const canPlay = canEdit && current !== null && current.status === 'active';

  const editor = usePositionEditor({ flipped });

  const engineState = useEngine(current?.fen ?? null, {
    engine,
    // The engine pauses while the position editor owns the board.
    enabled: engineOn && current !== null && !editor.editing,
    positionStatus: current?.status ?? 'active',
    multiPv: engineLines,
  });

  const checkSquare = useMemo(() => kingInCheckSquare(current?.fen ?? ''), [current?.fen]);

  /**
   * Legal moves are computed locally with chess.js — no server round trip.
   */
  const legalMoves = useMemo(() => {
    if (!canPlay || current === null) {
      return null;
    }
    return legalMovesFor(current.fen ?? '');
  }, [canPlay, current]);

  /**
   * Blunder flags while dragging: a dedicated second engine instance
   * evaluates the dragged candidate; the flag rides the same thresholds
   * as the move list. Needs the main analysis' baseline, so it waits for
   * a ready status.
   */
  const { flag: dragFlag, onDragHover: handleDragHover } = useDragFlag({
    enabled: engineOn && canPlay && !editor.editing,
    currentFen: current?.fen ?? null,
    currentEval: engineState.status === 'ready' ? engineState.eval : null,
    legalMoves,
    engine,
  });

  /**
   * Reset the square selection whenever the position changes. Uses the
   * React-recommended "adjust state during render" pattern instead of an
   * effect, so no extra render pass is needed.
   */
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setSelected(null);
  }

  const selectedMoves = useMemo(
    () => (selected === null ? [] : (legalMoves ?? []).filter((move) => move.from === selected)),
    [selected, legalMoves],
  );

  const legalTargets = selectedMoves.map((move) => move.to);

  /**
   * Plays a legal move: the editor broadcasts the op with all node data and
   * moves to the node every client will derive (max id + 1). The node is
   * kept in `pending` until the echo applies it to the tree; a rejection
   * rolls it back. Playing a move is a local navigation, so it also breaks
   * away from the presenter.
   */
  function playMove(move: LegalMove) {
    if (current === null || onPlayMove === undefined) {
      return;
    }
    const nodeId = maxNodeId + 1;
    onPlayMove(
      {
        ply: current.ply + 1,
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        fen: move.fen,
        status: move.status,
        parent_id: current.id,
      },
      () => rollbackPending(nodeId, current.id),
    );
    addPending({
      id: nodeId,
      ply: current.ply + 1,
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      comment: null,
      nags: [],
      status: move.status,
      fen: move.fen,
      children: [],
    });
    setSelected(null);
    navigate(nodeId);
  }

  /**
   * Inserts a line (engine PV or browsed book line) as a variation under
   * the viewed node. No optimistic update and no navigation: the echo adds
   * the line, and the user stays where they were analyzing.
   */
  function insertLineMoves(moves: LegalMove[]) {
    if (!canEdit || editor.editing || current === null || onAddLine === undefined) {
      return;
    }
    if (moves.length === 0) {
      return;
    }
    onAddLine({
      parent_id: current.id,
      moves: lineMovePayloads(moves),
    });
  }

  function lineMovePayloads(moves: LegalMove[]) {
    return moves.map((move) => ({
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      fen: move.fen,
      status: move.status,
    }));
  }

  function handleInsertLine(pv: string[]) {
    if (current === null) {
      return;
    }
    insertLineMoves(uciLineToMoves(current.fen ?? '', pv));
  }

  // The Examples dialog: the historical continuation (SANs) becomes a
  // variation under the viewed node. When the candidate's position is the
  // viewed one, it is a plain line; otherwise the candidate's position is
  // attached as a setup child first, and the line grafts onto it — the
  // teacher's "compare with if you didn't play h3" flow.
  function handleAddHistoricalVariation(fen: string, sans: string[], exact: boolean) {
    if (!canEdit || editor.editing || current === null) {
      return;
    }

    let maxNodeId = 0;
    for (const id of byId.keys()) {
      if (id > maxNodeId) {
        maxNodeId = id;
      }
    }

    const plan = planHistoricalVariation({
      exact,
      currentId: current.id,
      maxNodeId,
      currentFen: current.fen ?? '',
      candidateFen: fen,
      sans,
    });

    if (plan === null) {
      return;
    }

    if (plan.kind === 'line') {
      insertLineMoves(plan.moves);
      return;
    }

    if (onSetPosition === undefined || onAddLine === undefined) {
      return;
    }
    onSetPosition({ parent_id: plan.setup.parentId, fen: plan.setup.fen });
    onAddLine({ parent_id: plan.line.parentId, moves: lineMovePayloads(plan.line.moves) });
  }

  function handleSetPosition() {
    if (current === null || onSetPosition === undefined) {
      return;
    }
    const fen = editor.buildFen(current.fen ?? null);
    if (fen === null) {
      return;
    }
    const nodeId = maxNodeId + 1;
    onSetPosition({ parent_id: current.id, fen }, () => rollbackPending(nodeId, current.id));
    addPending({
      id: nodeId,
      ply: setupPlyFromFen(fen) ?? current.ply + 1,
      san: null,
      from: null,
      to: null,
      promotion: null,
      comment: null,
      nags: [],
      status: 'active',
      fen,
      children: [],
    });
    navigate(nodeId);
    editor.exitEditMode();
  }

  /**
   * Drag & drop. Play mode: a drag to a legal target plays the move; a drag
   * anywhere else falls back to selecting the piece. Edit mode: free-form
   * placement, and dropping off the board deletes the piece.
   */
  function handleDragMove(from: string, to: string | null) {
    if (editor.editing) {
      editor.handleEditDrag(from, to);
      return;
    }
    if (!canPlay || to === null) {
      return;
    }
    const move = (legalMoves ?? []).find((m) => m.from === from && m.to === to);
    if (move !== undefined) {
      playMove(move);
      return;
    }
    if ((legalMoves ?? []).some((m) => m.from === from)) {
      setSelected(from);
    }
  }

  function handleSquareClick(square: string) {
    if (!canPlay) {
      return;
    }
    const target = selectedMoves.find((move) => move.to === square);
    if (target !== undefined) {
      playMove(target);
      return;
    }
    if ((legalMoves ?? []).some((move) => move.from === square)) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  }

  const rows = useMemo(() => buildRows(tree), [tree]);

  /**
   * Whole-game views consume only the mainline's evals: a merged analysis
   * can carry variation nodes (node-keyed line analyses), and sharing a
   * ply with a mainline move must never leak one into the chart. Legacy
   * (node-id-less) evals are mainline by definition.
   */
  const mainlineEvals = useMemo(
    () =>
      (analysis ?? []).filter(
        (evaluation) => evaluation.node_id === undefined || mainlineIds.has(evaluation.node_id),
      ),
    [analysis, mainlineIds],
  );

  /** Mainline evals by ply, for the move list and the chart. */
  const evalsByPly = useMemo(
    () => Object.fromEntries(mainlineEvals.map((evaluation) => [evaluation.ply, evaluation])),
    [mainlineEvals],
  );

  /** Node-keyed evals (analyses since node-keying) — variation marks. */
  const evalsByNodeId = useMemo(() => {
    const map = new Map<number, AnalysisEval>();
    for (const evaluation of analysis ?? []) {
      if (evaluation.node_id !== undefined) {
        map.set(evaluation.node_id, evaluation);
      }
    }
    return map;
  }, [analysis]);

  /** The engine's best move before each move, for "best was …" readouts. */
  const bestMoves = useMemo(
    () =>
      tree === null || analysis === null
        ? new Map<number, string>()
        : bestMoveSans(tree.root, mainlineEvals),
    [tree, analysis, mainlineEvals],
  );

  /** Mainline node ids by ply, for the game-flow chart's click-to-jump. */
  const mainlineIdByPly = useMemo(() => {
    const map = new Map<number, number>();
    let node: GameNode | null = tree?.root ?? null;
    while (node !== null) {
      map.set(node.ply, node.id);
      node = node.children[0] ?? null;
    }
    return map;
  }, [tree]);

  const handleFlowSelect = useCallback(
    (ply: number) => {
      const id = mainlineIdByPly.get(ply);
      if (id !== undefined) {
        navigate(id);
      }
    },
    [mainlineIdByPly, navigate],
  );

  const handleFlip = useCallback(() => setFlipped((value) => !value), []);
  const openComment = useCallback(() => setCommentOpen(true), []);

  // The board header's "Find examples" (editors): captures the cursor's
  // request and opens the browsing dialog — a private query, so nothing
  // is shared with the room until a game is picked (ADR-0030).
  const openFindExamples = useCallback(() => {
    if (current === null || current.fen === null) {
      return;
    }
    setEvidenceDialog({ fen: current.fen, route: routeToCurrent, refPly: current.ply });
  }, [current, routeToCurrent]);

  useBoardKeyboard({
    tree,
    byId,
    current,
    navigate,
    canEdit,
    annotations,
    onAnnotations,
    onFlip: handleFlip,
    onOpenComment: openComment,
    // A modal owns the arrow keys while it is open (the examples dialog
    // pages its carousel with them); the board must not navigate under it.
    disabled: evidenceDialog !== null,
  });

  const nodeAnnotations = (current !== null ? annotations[current.id] : undefined) ?? {
    arrows: [],
    highlights: [],
  };

  const handleDrawArrow = useCallback(
    (from: string, to: string, color: string) => {
      if (current === null) {
        return;
      }
      // Redrawing an identical arrow removes it (lichess/chess.com style).
      const existing = nodeAnnotations.arrows.find((a) => a.from === from && a.to === to);
      onAnnotations?.(
        {
          arrows:
            existing !== undefined
              ? nodeAnnotations.arrows.filter((a) => a !== existing)
              : [...nodeAnnotations.arrows, { from, to, color }],
          highlights: nodeAnnotations.highlights,
        },
        current.id,
      );
    },
    [nodeAnnotations, current, onAnnotations],
  );

  const handleToggleHighlight = useCallback(
    (square: string, color: string) => {
      if (current === null) {
        return;
      }
      const exists = nodeAnnotations.highlights.some((h) => h.square === square);
      onAnnotations?.(
        {
          arrows: nodeAnnotations.arrows,
          highlights: exists
            ? nodeAnnotations.highlights.filter((h) => h.square !== square)
            : [...nodeAnnotations.highlights, { square, color }],
        },
        current.id,
      );
    },
    [nodeAnnotations, current, onAnnotations],
  );

  /**
   * The "Add as variation" button's state for a historical candidate:
   * whether the planned line is playable from the viewed node, and whether
   * it is already in the tree (the card then shows "Added ✓" — the echo
   * proves it, no optimistic bookkeeping). Plan-identical to the add
   * itself, so the check can never disagree with the insertion. `moves`
   * is the caller's pre-resolved SAN→moves line: this runs for every
   * candidate on every landing, and the resolution is the expensive part.
   */
  const variationState = useCallback(
    (fen: string, moves: LegalMove[], exact: boolean): { addable: boolean; exists: boolean } => {
      if (current === null) {
        return { addable: false, exists: false };
      }
      const plan = planFromResolvedMoves({
        exact,
        currentId: current.id,
        maxNodeId,
        candidateFen: fen,
        moves,
      });
      if (plan === null) {
        return { addable: false, exists: false };
      }
      if (plan.kind === 'line') {
        return { addable: true, exists: chainMatches(current, plan.moves) };
      }
      const setup = current.children.find((child) => child.fen === plan.setup.fen);
      return { addable: true, exists: setup !== undefined && chainMatches(setup, plan.line.moves) };
    },
    [current, maxNodeId],
  );

  if (tree === null || current === null) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 p-8">
        <p className="m-0 text-muted">{t('analysis.noGame')}</p>
      </div>
    );
  }

  const parent = byId.get(current.id)?.parent ?? null;
  const next = current.children[0] ?? null;
  const navTargets = {
    first: tree.root.id,
    prev: parent?.id ?? null,
    next: next?.id ?? null,
    last: current.children.length === 0 ? null : lastChildOf(current).id,
  };
  const hintArrows =
    engineOn && arrowsOn && engineState.bestMove !== null
      ? [{ ...engineState.bestMove, hint: true }]
      : [];

  // The hovered Reference row previews its move as a ghost arrow (the
  // engine-hint visual: translucent, never confusable with drawn
  // annotations). Local only — nothing is broadcast until the click. An
  // identical engine hint already covers it (and keeps the keys unique).
  const referenceGhostArrows =
    referenceGhost !== null &&
    !hintArrows.some((a) => a.from === referenceGhost.from && a.to === referenceGhost.to)
      ? [{ from: referenceGhost.from, to: referenceGhost.to, hint: true }]
      : [];

  const boardArrows = [...hintArrows, ...referenceGhostArrows, ...nodeAnnotations.arrows];

  /** The chart needs two points; the band action cares about any evals. */
  const hasAnalysis = mainlineEvals.length > 1;
  const hasAnyAnalysis = mainlineEvals.length > 0;

  /**
   * The whole-game analyze action in the timeline band's header — always
   * reachable, whatever layers are toggled on (a chip must never gate the
   * only path to an analysis). It owns the whole-game job's lifecycle:
   * "Analyze game" before any evals, live progress while a job runs, and
   * "Re-analyze" when the mainline outgrew the analysis. The engine box
   * keeps only its line-scoped "Analyze line".
   */
  const analysisMaxPly = mainlineEvals.reduce((max, e) => Math.max(max, e.ply), -1);
  // The actual mainline tip (not the declared count) — imports can lie.
  const mainlineTipPly = mainlineIdByPly.size - 1;
  // Any analysis counts for staleness (a single root eval too), even when
  // it's too small for the chart (hasAnalysis needs two points).
  const analysisStale = hasAnyAnalysis && mainlineTipPly > analysisMaxPly;
  const bandAnalyzeAction =
    onAnalyze === undefined || (hasAnyAnalysis && !analysisStale && analyzing === null)
      ? null
      : {
          label: analysisStale ? t('room.reanalyze') : t('room.analyzeGame'),
          progress: analyzing,
          onClick: () => onAnalyze(mainlinePositions(tree)),
        };

  const lineAnalyzePositions = linePath !== null ? variationPositions(linePath) : [];
  const lineFullyAnalyzed =
    lineAnalyzePositions.length > 0 &&
    lineAnalyzePositions.every((p) => p.node_id !== undefined && evalsByNodeId.has(p.node_id));
  const engineAnalyze =
    onAnalyze === undefined || !canEdit
      ? null
      : lineAnalyzePositions.length > 0 && !lineFullyAnalyzed
        ? {
            label: t('room.analyzeLine'),
            progress: analyzing,
            onClick: () => onAnalyze(lineAnalyzePositions),
          }
        : null;

  return (
    <div data-testid="analysis-root" className="flex w-full flex-col items-center gap-3 md:gap-6">
      {/*
        w-full is load-bearing: without it this wrapper shrink-wraps to its
        widest child's max-content (a long PV in the engine readout, a
        one-line game title), balloons past the viewport on phones, and the
        whole page pans sideways.
      */}
      {/*
        The board/sidebar row is display:contents below xl, so the board
        cell and the sidebar become direct children of this column and
        the timeline band slots between them (board → band → sidebar).
        At xl the row re-forms (board and sidebar side by side) and the
        band drops below it — the w-fit wrapper makes the band exactly
        as wide as the row above it, both centered as one block.
      */}
      <div className="flex w-full max-w-full flex-col items-center gap-3 md:gap-6 xl:w-fit">
        <div className="contents xl:flex xl:flex-row xl:items-start xl:gap-6">
          <BoardColumn
            tree={tree}
            current={current}
            opening={opening}
            engineOn={engineOn}
            engineState={engineState}
            flipped={flipped}
            editor={editor}
            selected={selected}
            legalTargets={legalTargets}
            arrows={boardArrows}
            highlights={nodeAnnotations.highlights}
            checkSquare={checkSquare}
            dragFlag={dragFlag}
            drawColor={drawColor}
            canPlay={canPlay}
            canEdit={canEdit}
            navTargets={navTargets}
            onSquareClick={canPlay ? handleSquareClick : undefined}
            onDragMove={editor.editing || canPlay ? handleDragMove : undefined}
            onDragHover={handleDragHover}
            onDrawArrow={canEdit ? handleDrawArrow : undefined}
            onToggleHighlight={canEdit ? handleToggleHighlight : undefined}
            onDrawColorChange={setDrawColor}
            drawColorPicker={canEdit ? { current: drawColor, onChange: setDrawColor } : undefined}
            clearDrawings={
              canEdit
                ? {
                    disabled:
                      nodeAnnotations.arrows.length === 0 &&
                      nodeAnnotations.highlights.length === 0,
                    onClear: () => onAnnotations?.({ arrows: [], highlights: [] }, current.id),
                  }
                : undefined
            }
            onFlip={handleFlip}
            onOpenComment={canEdit ? openComment : undefined}
            onFindExamples={canEdit ? openFindExamples : undefined}
            onSelect={navigate}
            onSetPosition={onSetPosition !== undefined ? handleSetPosition : undefined}
          />

          {/*
            The sidebar stretches to the board column's height on wide
            screens, so a long move list scrolls *inside* it and never
            stretches the page. Below xl it stacks full-width with a capped
            list. Comments live in a popup (the `c` key or the board
            controls), not here.
          */}
          <AnalysisSidebar
            tree={tree}
            current={current}
            book={book}
            byId={byId}
            rows={rows}
            engineState={engineState}
            engineOn={engineOn}
            arrowsOn={arrowsOn}
            engineLines={engineLines}
            editor={editor}
            evalsByPly={evalsByPly}
            evalsByNodeId={evalsByNodeId}
            bestMoves={bestMoves}
            bookExitPly={bookExitPly}
            mainlineEvals={mainlineEvals}
            hasAnalysis={hasAnalysis}
            mainlineOpening={mainlineOpening}
            engineAnalyze={engineAnalyze}
            linePath={linePath}
            linePathText={linePathText}
            canEdit={canEdit}
            canPlay={canPlay}
            flipped={flipped}
            onNavigate={navigate}
            onPlayMove={playMove}
            onInsertLine={handleInsertLine}
            onReferenceGhost={setReferenceGhost}
            onFlowSelect={handleFlowSelect}
            onToggleEngine={toggleEngine}
            onToggleArrows={toggleArrows}
            onEngineLines={setEngineLinesCount}
          />
        </div>

        {/*
          The timeline band (ADR-0024, as amended): the whole-game charts as
          stacked layers on one shared move axis, full width under the
          board+sidebar row at xl and right under the board below it.
        */}
        <div className="order-2 w-full">
          <TimelineBand
            tree={tree}
            evals={mainlineEvals}
            currentPly={current.ply}
            flipped={flipped}
            openingExitPly={bookExitPly}
            endgameStartPly={endgamePly}
            captures={captures}
            bestMoves={bestMoves}
            spanPly={mainlineTipPly}
            hasAnalysis={hasAnalysis}
            analyzeAction={bandAnalyzeAction}
            onSelectPly={handleFlowSelect}
          />
        </div>
      </div>

      {editor.paletteGhost !== null && (
        <img
          src={pieceSrc(editor.paletteGhost.piece)}
          alt=""
          draggable={false}
          data-testid="palette-ghost"
          className="pointer-events-none fixed z-50 h-12 w-12 -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ left: editor.paletteGhost.x, top: editor.paletteGhost.y }}
        />
      )}

      {commentOpen && (
        <CommentPopup
          comment={current.comment}
          nags={current.nags}
          moveLabel={
            current.san
              ? `${Math.ceil(current.ply / 2)}${current.ply % 2 === 1 ? '.' : '...'} ${current.san}`
              : null
          }
          onSave={(text, nags) => {
            if (text !== (current.comment ?? '')) {
              onComment?.({ ply: current.ply, text, node_id: current.id });
            }
            if (nags.join(',') !== current.nags.join(',')) {
              onSetNags?.({ node_id: current.id, nags });
            }
          }}
          onClose={() => setCommentOpen(false)}
        />
      )}

      {evidenceDialog !== null && (
        <HistoricalEvidenceDialog
          fen={evidenceDialog.fen}
          route={evidenceDialog.route}
          refPly={evidenceDialog.refPly}
          gameHeaders={tree.headers}
          onClose={() => setEvidenceDialog(null)}
          onAddGame={canEdit ? onAddHistoricalGame : undefined}
          onAddVariation={canEdit ? handleAddHistoricalVariation : undefined}
          variationState={canEdit ? variationState : undefined}
          addedGids={addedEvidenceGids}
        />
      )}
    </div>
  );
}

/**
 * The mainline positions (with node ids) for a whole-game (re-)analysis:
 * every position from the root to the mainline tip.
 */
function mainlinePositions(tree: GameTree): AnalysisPosition[] {
  const positions: AnalysisPosition[] = [];
  let node: GameNode = tree.root;
  while (true) {
    if (node.fen !== null) {
      positions.push({ ply: node.ply, fen: node.fen, node_id: node.id });
    }
    const next = node.children[0];
    if (next === undefined) {
      break;
    }
    node = next;
  }
  return positions;
}

/**
 * The viewed variation's positions for "Analyze line": the off-mainline
 * segment from the branch point (exclusive) down the viewed line to its
 * tip. The branch's own eval comes from the mainline analysis (when it
 * exists), so marks line up across the junction.
 */
function variationPositions(linePath: { nodes: GameNode[] }): AnalysisPosition[] {
  const segment: GameNode[] = [...linePath.nodes];
  let tip = segment[segment.length - 1];
  while (tip.children[0] !== undefined) {
    tip = tip.children[0];
    segment.push(tip);
  }
  return segment
    .filter((node) => node.fen !== null)
    .map((node) => ({ ply: node.ply, fen: node.fen as string, node_id: node.id }));
}

function lastChildOf(node: GameNode): GameNode {
  return node.children[0] ? lastChildOf(node.children[0]) : node;
}

/**
 * Whether `start` already carries a child chain matching `moves` — the
 * same from/to/promotion descent the `add_line` echo uses to de-duplicate
 * against existing children.
 */
function chainMatches(start: GameNode, moves: LegalMove[]): boolean {
  let node = start;
  for (const move of moves) {
    const next = node.children.find(
      (child) =>
        child.from === move.from && child.to === move.to && child.promotion === move.promotion,
    );
    if (next === undefined) {
      return false;
    }
    node = next;
  }
  return true;
}
