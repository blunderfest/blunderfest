import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowIcon from '@/components/ArrowIcon';
import Board from '@/components/Board';
import { DRAW_COLORS, kingInCheckSquare, parseFen, pieceSrc } from '@/components/board';
import { button, panel } from '@/components/ui';
import BoardControls from '@/features/analysis/BoardControls';
import CommentPopup from '@/features/analysis/CommentPopup';
import CriticalMoments from '@/features/analysis/CriticalMoments';
import EngineBox from '@/features/analysis/EngineBox';
import EvalBar from '@/features/analysis/EvalBar';
import type { ChessEngine } from '@/features/analysis/engine';
import { bestMoveSans } from '@/features/analysis/evalMarks';
import GameActions from '@/features/analysis/GameActions';
import GameInfo from '@/features/analysis/GameInfo';
import GameReport from '@/features/analysis/GameReport';
import { endgameStart } from '@/features/analysis/gamePhases';
import { legalMovesFor, uciLineToMoves } from '@/features/analysis/legalMoves';
import { capturesOf } from '@/features/analysis/MaterialFlow';
import MoveList from '@/features/analysis/MoveList';
import { buildRows } from '@/features/analysis/moveList';
import NavControls from '@/features/analysis/NavControls';
import { buildNodeMap } from '@/features/analysis/nodeMap';
import {
  classifyOpening,
  loadOpeningBook,
  type OpeningBook,
  openingExitPly,
} from '@/features/analysis/openings';
import ReferencePanel from '@/features/analysis/ReferencePanel';
import SidebarTabs, { type SidebarTab } from '@/features/analysis/SidebarTabs';
import TimelineBand from '@/features/analysis/TimelineBand';
import type { WhiteEval } from '@/features/analysis/uci';
import { useBoardKeyboard } from '@/features/analysis/useBoardKeyboard';
import { useCursor } from '@/features/analysis/useCursor';
import { useDragFlag } from '@/features/analysis/useDragFlag';
import { useEngine } from '@/features/analysis/useEngine';
import { usePositionEditor } from '@/features/analysis/usePositionEditor';
import HistoricalEvidencePanel from '@/features/historicalEvidence/HistoricalEvidencePanel';
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

export default function Analysis({
  tree,
  presenterId = null,
  selfId = null,
  presenterCursorId = null,
  following = false,
  canEdit = false,
  engine = undefined,
  lastPlayedId = null,
  onFollowChange,
  onCursorChange,
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
}: {
  tree: GameTree | null;
  presenterId?: string | null;
  selfId?: string | null;
  presenterCursorId?: number | null;
  following?: boolean;
  canEdit?: boolean;
  engine?: ChessEngine | null;
  lastPlayedId?: number | null;
  onFollowChange?: (following: boolean) => void;
  onCursorChange?: (nodeId: number) => void;
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
}) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  /** The Reference row under the pointer — its move previews as a ghost arrow. */
  const [referenceGhost, setReferenceGhost] = useState<LegalMove | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
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
    amPresenter,
    startAtRoot,
    onCursorChange,
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
      moves: moves.map((move) => ({
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        fen: move.fen,
        status: move.status,
      })),
    });
  }

  function handleInsertLine(pv: string[]) {
    if (current === null) {
      return;
    }
    insertLineMoves(uciLineToMoves(current.fen ?? '', pv));
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
  const boardLabel = t('analysis.boardLabel', { move: current.san ?? t('analysis.startPosition') });
  const evalBarLabel = evalAriaLabel(engineState.eval, t);
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

  // The visualization box: the list-like views (Moments, Report) — the
  // whole-game timeline charts (Eval, Material, Activity, Clocks) live in
  // the timeline band under the board (ADR-0024, as amended). Both tabs
  // are always present; until an analysis runs they show a plain note.
  const vizTabs: SidebarTab[] = [];
  const noAnalysisNote = (
    <div className="grid h-full place-items-center">
      <p className="m-0 text-note text-faint">{t('analysis.noAnalysisYet')}</p>
    </div>
  );
  const hasAnalysis = mainlineEvals.length > 1;
  // The initial whole-game analyze action sits in the timeline band's
  // header — always reachable, whatever layers are toggled on (a chip
  // must never gate the only path to an analysis).
  const bandAnalyzeAction =
    !hasAnalysis && onAnalyze !== undefined
      ? {
          label: t('room.analyzeGame'),
          progress: analyzing,
          onClick: () => onAnalyze(mainlinePositions(tree)),
        }
      : null;

  /**
   * The analyze action in the engine box: "Analyze line" for a viewed
   * variation (its segment not fully analyzed), "Re-analyze" when the
   * mainline outgrew the analysis (moves played after the job). The
   * initial "Analyze game" lives in the timeline band header.
   */
  const analysisMaxPly = mainlineEvals.reduce((max, e) => Math.max(max, e.ply), -1);
  // The actual mainline tip (not the declared count) — imports can lie.
  const mainlineTipPly = mainlineIdByPly.size - 1;
  // Any analysis counts for staleness (a single root eval too), even when
  // it's too small for the chart (hasAnalysis needs two points).
  const analysisStale = mainlineEvals.length > 0 && mainlineTipPly > analysisMaxPly;
  const lineAnalyzePositions = linePath !== null ? variationPositions(linePath) : [];
  const lineFullyAnalyzed =
    lineAnalyzePositions.length > 0 &&
    lineAnalyzePositions.every((p) => p.node_id !== undefined && evalsByNodeId.has(p.node_id));
  const analyzeAction =
    onAnalyze === undefined || !canEdit
      ? null
      : lineAnalyzePositions.length > 0
        ? lineFullyAnalyzed
          ? null
          : {
              label: t('room.analyzeLine'),
              positions: lineAnalyzePositions,
            }
        : analysisStale
          ? { label: t('room.reanalyze'), positions: mainlinePositions(tree) }
          : null;

  vizTabs.push({
    id: 'moments',
    label: t('analysis.momentsTab'),
    content: (
      // Same outer height as the report tab (p-2 + h-44): no shift on switch.
      <div className="p-2">
        <div className="h-44 overflow-y-auto">
          {hasAnalysis ? (
            <CriticalMoments
              tree={tree}
              evals={mainlineEvals}
              flipped={flipped}
              onSelectPly={handleFlowSelect}
            />
          ) : (
            noAnalysisNote
          )}
        </div>
      </div>
    ),
  });
  vizTabs.push({
    id: 'report',
    label: t('analysis.reportTab'),
    content: (
      // Same outer height as the moments tab (p-2 + h-44): no shift on switch.
      <div className="p-2">
        <div className="h-44 overflow-y-auto">
          {hasAnalysis ? (
            <GameReport
              tree={tree}
              evals={mainlineEvals}
              opening={mainlineOpening}
              onSelectPly={handleFlowSelect}
            />
          ) : (
            noAnalysisNote
          )}
        </div>
      </div>
    ),
  });

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
          <div className="order-1 flex max-w-full flex-col items-center gap-4">
            <div className="flex w-full items-baseline justify-between gap-4">
              <h2 className="m-0 min-w-0 text-display font-bold tracking-[-0.02em]">
                {tree.headers.White ?? '?'} – {tree.headers.Black ?? '?'}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <p className="m-0 whitespace-nowrap text-muted">{tree.result}</p>
                <GameActions tree={tree} />
              </div>
            </div>
            {/*
            Fixed-height slot: the board must never shift when the name
            appears or changes — empty at the start position.
          */}
            <p
              data-testid="opening-name"
              aria-hidden={opening === null}
              className="m-0 -mt-2 h-[1.125rem] w-full text-note font-semibold text-gold-hi"
            >
              {opening === null ? '' : `${opening.eco} · ${opening.name}`}
            </p>

            {/*
            The board column is always centered. The eval bar hangs off its
            left edge, out of flow, so toggling the engine (or the edit
            palette) never shifts the board. The ml-13 margin reserves that
            slot whenever the bar is shown: centering alone would let it
            cross the content's left edge (off-screen on phones, over the
            rail at md) — the board's width formula reserves exactly this
            slot (100vw - page padding - 2.5rem - gap, minus the rail at
            md).

            The edit palette sits on each side's home edge (black pieces on
            black's side, white on white's — swapped when flipped), like
            lichess's editor. No scroll strip.
          */}
            <div
              className={`relative flex flex-col items-stretch gap-2 ${
                !editor.editing && engineOn ? 'ml-13' : ''
              }`}
              data-tour="board"
            >
              {!editor.editing && engineOn && (
                <div
                  className="absolute top-0 right-full bottom-0 mr-3 flex w-10 flex-col justify-center"
                  data-testid="board-left-slot"
                >
                  <EvalBar
                    eval={engineState.eval}
                    thinking={engineState.status === 'thinking'}
                    unavailable={engineState.status === 'error'}
                    flipped={flipped}
                    label={evalBarLabel}
                  />
                </div>
              )}
              {editor.editing && (
                <PaletteStrip editor={editor} color={flipped ? 'w' : 'b'} side="top" />
              )}
              <Board
                position={editor.editing ? editor.editPos : parseFen(current.fen ?? '')}
                lastMove={current.from ? { from: current.from, to: current.to ?? '' } : null}
                flipped={flipped}
                label={boardLabel}
                interactive={editor.editing || canPlay || canEdit}
                selected={editor.editing ? editor.editSelected : selected}
                legalTargets={editor.editing ? [] : legalTargets}
                arrows={editor.editing ? [] : boardArrows}
                highlights={editor.editing ? [] : nodeAnnotations.highlights}
                checkSquare={editor.editing ? null : checkSquare}
                onSquareClick={
                  editor.editing
                    ? editor.handleEditSquareClick
                    : canPlay
                      ? handleSquareClick
                      : undefined
                }
                onDragMove={editor.editing || canPlay ? handleDragMove : undefined}
                onDragHover={handleDragHover}
                dragMark={dragFlag}
                onDrawArrow={canEdit && !editor.editing ? handleDrawArrow : undefined}
                onToggleHighlight={canEdit && !editor.editing ? handleToggleHighlight : undefined}
                drawColor={drawColor}
                onDrawColorChange={canEdit && !editor.editing ? setDrawColor : undefined}
                paintBrush={editor.editing ? editor.editBrush : null}
                onPaintSquare={
                  editor.editing && editor.editBrush !== null ? editor.paintSquare : undefined
                }
              />
              {editor.editing && (
                <div className="flex w-full items-center justify-between">
                  <PaletteStrip editor={editor} color={flipped ? 'b' : 'w'} side="bottom" />
                  {/* The eraser stands apart, flush with the board's right edge. */}
                  <button
                    type="button"
                    aria-pressed={editor.editBrush === 'erase'}
                    aria-label={t('analysis.eraser')}
                    data-testid="eraser-button"
                    className={`grid h-9 w-9 place-items-center rounded-control border text-base transition-colors ${
                      editor.editBrush === 'erase'
                        ? 'border-gold/60 bg-gold/20 text-gold-hi'
                        : 'border-line bg-panel text-muted hover:bg-raised'
                    }`}
                    onClick={() => editor.toggleBrush('erase')}
                  >
                    ⌫
                  </button>
                </div>
              )}
            </div>
            {editor.editing && (
              <div
                className="flex w-full max-w-[min(90vw,34rem)] flex-col gap-2 rounded-control border border-line bg-panel p-3"
                data-testid="edit-toolbar"
              >
                <p className="m-0 text-ui text-muted">{t('analysis.editModeHint')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={button({ intent: 'quiet', size: 'sm' })}
                    onClick={editor.toggleTurn}
                    data-testid="edit-turn-toggle"
                  >
                    {editor.editTurn === 'w'
                      ? t('analysis.whiteToMove')
                      : t('analysis.blackToMove')}
                  </button>
                  <button
                    type="button"
                    className={button({ intent: 'quiet', size: 'sm' })}
                    onClick={editor.clearBoard}
                    data-testid="edit-clear-button"
                  >
                    {t('analysis.clearBoard')}
                  </button>
                  <button
                    type="button"
                    className={button({ intent: 'quiet', size: 'sm' })}
                    onClick={() => editor.resetPosition(current.fen ?? null)}
                    data-testid="edit-reset-button"
                  >
                    {t('analysis.resetPosition')}
                  </button>
                  <button
                    type="button"
                    className={button({ intent: 'primary', size: 'sm' })}
                    onClick={handleSetPosition}
                    data-testid="set-position-button"
                  >
                    {t('analysis.done')}
                  </button>
                  <button
                    type="button"
                    className={button({ intent: 'ghost', size: 'sm' })}
                    onClick={editor.exitEditMode}
                  >
                    {t('analysis.cancelEdit')}
                  </button>
                </div>
                {editor.editError && (
                  <p className="m-0 text-ui text-bad-hi" role="alert">
                    ⚠ {t('analysis.invalidSetup')}
                  </p>
                )}
              </div>
            )}
            {/*
            The move navigation lives directly under the board at every
            size (lichess-style) — the move list is a pure list now.
          */}
            {!editor.editing && (
              <NavControls
                navTargets={navTargets}
                currentId={current.id}
                currentPly={current.ply}
                totalPly={tree.mainline_ply_count}
                onSelect={navigate}
              />
            )}
            {current.comment !== null && (
              <div
                className="w-full max-w-[min(90vw,34rem)] rounded-control border border-line bg-panel p-3 text-body text-ink"
                data-testid="comment-bubble"
              >
                {current.comment}
              </div>
            )}
            <p className="sr-only" role="status">
              {selected !== null ? t('analysis.selected', { square: selected }) : boardLabel}
            </p>
            <BoardControls
              flipped={flipped}
              onFlip={handleFlip}
              onOpenComment={canEdit ? openComment : undefined}
              onToggleEdit={
                canEdit && onSetPosition !== undefined
                  ? () =>
                      editor.editing
                        ? editor.exitEditMode()
                        : editor.enterEditMode(current?.fen ?? null)
                  : undefined
              }
              editing={editor.editing}
              drawColorPicker={canEdit ? { current: drawColor, onChange: setDrawColor } : undefined}
              clearDrawings={
                canEdit
                  ? {
                      disabled:
                        current === null ||
                        (nodeAnnotations.arrows.length === 0 &&
                          nodeAnnotations.highlights.length === 0),
                      onClear: () => {
                        if (current !== null) {
                          onAnnotations?.({ arrows: [], highlights: [] }, current.id);
                        }
                      },
                    }
                  : undefined
              }
            />
            <p className="m-0 hidden text-note text-faint md:block">
              <kbd className="inline-flex items-center">
                <ArrowIcon of="left" className="h-3 w-3" />
              </kbd>{' '}
              <kbd className="inline-flex items-center">
                <ArrowIcon of="right" className="h-3 w-3" />
              </kbd>{' '}
              {t('analysis.shortcutNav')} · <kbd>Home</kbd> <kbd>End</kbd>{' '}
              {t('analysis.shortcutJump')} · <kbd>f</kbd> {t('analysis.shortcutFlip')} ·{' '}
              <kbd>c</kbd> {t('analysis.shortcutNote')}
            </p>
            {current.status !== 'active' && (
              <p
                id="analysis-status"
                className="m-0 text-ui font-semibold text-gold-hi"
                role="status"
              >
                {t(`analysis.status.${current.status}`)}
              </p>
            )}
          </div>

          {/*
          The sidebar stretches to the board column's height on wide
          screens, so a long move list scrolls *inside* it and never
          stretches the page. Below xl it stacks full-width with a capped
          list. Comments live in a popup (the `c` key or the board
          controls), not here.
        */}
          {/*
          The sidebar's height matches the board column's at xl: the board
          (34rem) plus the nav row, controls and hints (13rem, measured).
          A computed cap, not self-stretch — stretch lets a long move list
          grow the flex line instead of scrolling inside itself.
        */}
          <aside className="order-3 flex w-full max-w-[min(100%,24rem)] flex-col gap-3 xl:h-[calc(min(90vw,34rem)+13rem)] xl:w-[340px]">
            <SidebarTabs
              tabs={[
                {
                  id: 'analysis',
                  label: t('analysis.moves'),
                  content: (
                    // One coherent panel: the engine section on top, the move
                    // list scrolling below — lichess's analysis panel.
                    <section
                      className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-1 flex-col overflow-hidden`}
                      data-tour="analysis-panel"
                    >
                      <EngineBox
                        fen={current.fen ?? ''}
                        state={engineState}
                        engineOn={engineOn}
                        arrowsOn={arrowsOn}
                        linesCount={engineLines}
                        paused={editor.editing}
                        onToggleEngine={toggleEngine}
                        onToggleArrows={toggleArrows}
                        onLinesCount={setEngineLinesCount}
                        onInsertLine={
                          canEdit && !editor.editing && onAddLine !== undefined
                            ? handleInsertLine
                            : undefined
                        }
                        analyze={
                          analyzeAction !== null && onAnalyze !== undefined
                            ? {
                                label: analyzeAction.label,
                                progress: analyzing,
                                onClick: () => onAnalyze(analyzeAction.positions),
                              }
                            : null
                        }
                      />
                      {linePath !== null && linePathText !== null && (
                        // Off-mainline bearings: the path from the branch
                        // point; clicking returns to it.
                        <button
                          type="button"
                          data-testid="line-path"
                          title={t('analysis.backToMainline')}
                          aria-label={t('analysis.backToMainline')}
                          className="flex shrink-0 items-center gap-1.5 border-t border-line px-3 py-1.5 text-left text-note text-muted transition-colors hover:bg-raised hover:text-ink"
                          onClick={() => {
                            if (linePath.branchId !== null) {
                              navigate(linePath.branchId);
                            }
                          }}
                        >
                          <ArrowIcon of="left" className="h-3 w-3 shrink-0" />
                          <span className="truncate tabular-nums">{linePathText}</span>
                        </button>
                      )}
                      <MoveList
                        rows={rows}
                        currentId={current.id}
                        onSelect={navigate}
                        evalsByPly={evalsByPly}
                        evalsByNodeId={evalsByNodeId}
                        parentOf={(id) => byId.get(id)?.parent ?? null}
                        bookExitPly={bookExitPly}
                        bestMoves={bestMoves}
                      />
                    </section>
                  ),
                },
                {
                  id: 'game',
                  label: t('room.gameInfo'),
                  content: <GameInfo tree={tree} />,
                },
                {
                  id: 'reference',
                  label: t('analysis.referenceTab'),
                  content: (
                    <section
                      className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-1 flex-col overflow-hidden`}
                    >
                      <ReferencePanel
                        book={book}
                        fen={current?.fen ?? null}
                        onPlayMove={canPlay && !editor.editing ? playMove : undefined}
                        onHoverMove={setReferenceGhost}
                      />
                    </section>
                  ),
                },
                {
                  id: 'history',
                  label: t('evidence.tab'),
                  content: (
                    <section
                      className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-1 flex-col overflow-hidden`}
                    >
                      <HistoricalEvidencePanel
                        fen={current?.fen ?? null}
                        route={routeToCurrent}
                        refPly={current?.ply ?? null}
                        canAnalyze={canEdit}
                      />
                    </section>
                  ),
                },
              ]}
            />
            {/*
            The visualization box sits below the tabs so it stays visible no
            matter which tab is active. A constant height (h-44 + padding),
            so the move list never resizes — the charts stretch to fill it.
          */}
            {vizTabs.length > 0 && (
              <section
                className={`${panel({ layout: 'none', pad: 'none' })} shrink-0 overflow-hidden`}
                data-testid="viz-box"
                data-tour="viz-box"
              >
                <SidebarTabs tabs={vizTabs} />
              </section>
            )}
          </aside>
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
    </div>
  );
}

/** The last node of the mainline (deepest first-child chain). */
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
 * One edge of the edit palette: a color's six pieces in a horizontal strip.
 * The parent places it on that side's home edge (top for black, bottom for
 * white, swapped when flipped); the eraser rides the bottom strip.
 */
function PaletteStrip({
  editor,
  color,
  side,
}: {
  editor: ReturnType<typeof usePositionEditor>;
  color: 'w' | 'b';
  side: 'top' | 'bottom';
}) {
  const { t } = useTranslation();
  // The tray color is theme-aware: a muted slate on dark, a soft gray on
  // light — quiet, but the solid-black pawn still reads on both. Pieces sit
  // on tiles the size of a board square. Left-aligned (the eraser floats
  // right of the bottom strip, so centering would overlap it).
  return (
    <div
      className="flex items-center justify-start gap-1 self-start rounded-control border border-line bg-tray px-2 py-1"
      data-testid={side === 'top' ? 'edit-palette' : undefined}
    >
      {(['k', 'q', 'r', 'b', 'n', 'p'] as const).map((kind) => {
        const active =
          editor.editBrush !== null &&
          editor.editBrush !== 'erase' &&
          editor.editBrush.color === color &&
          editor.editBrush.kind === kind;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            aria-label={t('analysis.pieceLabel', {
              color: t(color === 'w' ? 'analysis.sideWhite' : 'analysis.sideBlack'),
              piece: t(`analysis.pieces.${kind}`),
            })}
            className={`grid h-[min(calc((100vw-4.75rem)/8),4.25rem)] w-[min(calc((100vw-4.75rem)/8),4.25rem)] place-items-center rounded-control leading-none transition-colors md:h-[min(calc((100vw-20.25rem)/8),4.25rem)] md:w-[min(calc((100vw-20.25rem)/8),4.25rem)] ${
              active ? 'bg-gold/25 ring-1 ring-gold/60' : 'hover:bg-black/10'
            }`}
            onPointerDown={(event) => editor.handlePalettePointerDown({ color, kind }, event)}
            onClick={() => editor.handlePaletteClick({ color, kind })}
          >
            <img
              src={pieceSrc({ color, kind })}
              alt=""
              draggable={false}
              className="h-[85%] w-[85%] select-none"
            />
          </button>
        );
      })}
    </div>
  );
}

/** The eval bar's aria-label, in words, from white's perspective. */
function evalAriaLabel(white: WhiteEval | null, t: TFunction): string {
  if (white === null) {
    return t('analysis.evalBar');
  }
  if (white.type === 'result') {
    return white.result === '1-0'
      ? t('analysis.evalWhiteWon')
      : white.result === '0-1'
        ? t('analysis.evalBlackWon')
        : t('analysis.evalDrawn');
  }
  if (white.type === 'mate') {
    return white.moves > 0
      ? t('analysis.evalMateWhite', { count: white.moves })
      : t('analysis.evalMateBlack', { count: -white.moves });
  }
  if (white.cp === 0) {
    return t('analysis.evalEqual');
  }
  return white.cp > 0
    ? t('analysis.evalWhiteBetter', { value: (white.cp / 100).toFixed(2) })
    : t('analysis.evalBlackBetter', { value: (-white.cp / 100).toFixed(2) });
}
