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
 *   id: string,
 *   tags: Tag[]
 * } & GameNode} GameFromServer
 *
 * @typedef {{
 *   move: Move
 * } & GameNode} VariationFromServer
 *
 * @typedef {{
 *   id: string,
 *   move: Move,
 *   ply: number,
 *   moves: MappedMove[]
 * }} MappedMove
 *
 * @typedef {{
 *   id: String,
 *   positionId: String,
 *   move: Move,
 *   ply: Number,
 *   fen: String
 * }} MovedFromServer
 */
