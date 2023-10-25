/**
 * @typedef {"none" | "simple" | "alt" | "ctrl"} Mark
 *
 * @typedef {"black" | "white"} Color
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
 *   promotion: Piece?
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
 *   fen: string,
 *   ply: number,
 *   arrows: Arrow[],
 *   marks: Mark[]
 * }} Position
 *
 * @typedef {{
 *   position: Position,
 *   variations: Array<Variation>
 * }} GameNode
 *
 * @typedef {{
 *   id: string
 * } & GameNode} Game
 *
 * @typedef {{
 *   move: Move
 * } & GameNode} Variation
 */
