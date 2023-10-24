/**
 * @typedef {import("i18next").i18n} I18n
 * @typedef {"en" | "nl"} Language
 */

/**
 * @typedef {import("react").JSX.Element} Children
 */

/**
 * @template T
 * @typedef {[T, import('react').Dispatch<import('react').SetStateAction<T>>]} useState
 */

/**
 * @template T
 * @typedef {import('@reduxjs/toolkit').PayloadAction<T>} PayloadAction
 */

/**
 * @typedef {"none" | "simple" | "alt" | "ctrl"} Mark
 *
 * @typedef {{
 *   piece: "king" | "queen" | "rook" | "bishop" | "knight" | "pawn",
 *   color: "black" | "white"
 * }} Piece
 *
 * @typedef {{
 *   squareIndex: number,
 *   file: string,
 *   rank: number,
 *   color: "light" | "dark"
 *   piece?: Piece
 * }} Square
 *
 * @typedef {{
 *   san: string,
 *   position: Position2
 * }} Move
 *
 * @typedef {{
 *   fen: string,
 *   moves: Move[]
 * }} Position2
 *
 * @typedef {{
 *   id: string,
 *   positions: Position2[],
 *   currentPosition: number[]
 * }} Game
 *
 * @typedef {{
 *   selectedSquare: number?,
 *   marks: Array<Mark>
 * }} Board
 *
 * @typedef {{
 *   squares: Square[],
 *   activeColor: "white" | "black",
 *   castlingAvailability: string[],
 *   enPassant: number?,
 *   halfmoveClock: number,
 *   fullmoveNumber: number,
 * }} Position
 */
