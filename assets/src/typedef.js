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
 *   positionId: string,
 *   fen: string,
 *   ply: number,
 *   arrows: Arrow[],
 *   selectedSquareIndex: number?
 * }} PositionFromServer
 *
 * @typedef {{
 *   position: PositionFromServer,
 *   variations: Array<VariationFromServer>
 * }} GameNode
 *
 * @typedef {{
 *   name: string,
 *   value: string
 * }} Tag
 *
 * @typedef {{
 *   gameCode: string,
 *   tags: Tag[]
 * } & GameNode} GameFromServer
 *
 * @typedef {{
 *   move: Move
 * } & GameNode} VariationFromServer
 */
