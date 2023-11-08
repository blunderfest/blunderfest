/**
 * @template T
 * @typedef {import("@reduxjs/toolkit").PayloadAction<T>} PayloadAction
 */

/**
 * @typedef {"none" | "simple" | "alt" | "ctrl"} Mark
 *
 * @typedef {"dark" | "light"} Color
 *
 * @typedef {"K" | "Q" | "R" | "B" | "N" | "P" | "k" | "q" | "r" | "b" | "n" | "p"} Piece
 *
 * @typedef {{
 *   rank: number,
 *   file: string
 * }} Square
 *
 * @typedef {{
 *   from: number,
 *   to: number,
 *   promotion?: Piece
 * }} Move
 *
 * @typedef {{
 *   from: Square,
 *   to: Square,
 *   color: Mark
 * }} Arrow
 *
 * @typedef {{
 *   rank: number,
 *   file: string,
 *   squareIndex: number,
 *   color: Color,
 *   piece: Piece?
 * }} ParsedSquare
 *
 * @typedef {{
 *   squares: ParsedSquare[],
 *   activeColor: "white" | "black",
 *   castlingAvailability: string[],
 *   enPassant: number?,
 *   halfmoveClock: number,
 *   fullmoveNumber: number,
 * }} ParsedPosition
 *
 * @typedef {{
 *   id: string,
 *   fen: string,
 *   ply: number,
 *   arrows: Arrow[],
 *   selectedSquareIndex: number?
 * }} Position
 *
 * @typedef {{
 *   position: Position,
 *   variations: Array<Variation>
 * }} GameNode
 *
 * @typedef {{
 *   name: string,
 *   value: string
 * }} Tag
 *
 * @typedef {{
 *   id: string,
 *   tags: Tag[]
 * } & GameNode} Game
 *
 * @typedef {{
 *   move: Move
 * } & GameNode} Variation
 *
 * @typedef {{
 *   id: string,
 *   move: Move,
 *   ply: number,
 *   moves: MappedMove[]
 * }} MappedMove
 */
