# ADR-0011: Free-form position setup ("what if the pawn were on h3?")

Status: Accepted (2026-08-07)

## Context

Reviewing games is unstructured. People talk about a position and ask "but
what if the white pawn was on h3 instead?" — a question that is not a move:
it may be the other side's turn, the piece may jump arbitrarily, and the
resulting position may be unreachable by legal play from the current node.

Our authoritative room state is an op log of *legal moves* (ADR-0005), which
cannot express this. Relaxing `move_at_ply` to allow illegal moves was
considered and rejected: it would corrupt move semantics and break everything
downstream that assumes legal chains (engine, FEN derivation, PGN export).

## Decision

A new op type, **`set_position`**, payload `{ game_id, parent_id, fen }`:

- Replays as a **setup node** in the variation tree: a child of `parent_id`
  whose `fen` is the edited position. At a leaf it continues the line;
  mid-line it becomes a variation — the main line is never rewritten.
- The setup node's `ply` is derived from the FEN (`fullmove` + side to move),
  so move numbering of everything played below it is correct for free.
- Setup nodes render in the move list as an italic `⚙ Setup` token, not a
  numbered move.
- Editors (owner/collaborator) enter an **edit mode** on the board: click a
  piece to pick it up, click any square to drop it (replacing whatever is
  there), a side-to-move toggle, then "Set position". Castling rights and en
  passant are reset (`-`) in v1 — setups rarely preserve them.
- The client validates the FEN with chess.js before sending (kings present,
  no back-rank pawns, no impossible checks). The server stays
  payload-agnostic; `set_position` joins the edit-gated op types so viewers
  cannot push it.
- The echo lands the setup node like any op; the editor's cursor moves to it
  immediately via the existing pending-node mechanism. Engine, check glow,
  and legal-move fetching all work on the edited position unchanged, because
  they are FEN-driven.

A client-local sandbox (edit without syncing) was rejected: the point of the
feature is that everyone in the room sees the same what-if.

## Consequences

- The tree gains a non-move node kind (`san: null` outside the root). Move
  list, node map, and replay all handle it; PGN export (when it ships) maps
  setup nodes to `[FEN "..."]` sections naturally.
- Edit ops are broadcast to everyone, so one person's edit moves everyone's
  board when they're following — intended, same as moves.
- v1 limitations: no adding/removing pieces (only moving; dropping on a piece
  replaces it), and castling/en-passant rights reset. (The initial "no
  comments on setup nodes" limitation was lifted when comment ops learned to
  address nodes by `node_id` instead of mainline ply.)
