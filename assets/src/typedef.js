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
 *   position: Position
 * }} Move
 *
 * @typedef {{
 *   fen: string,
 *   selectedSquare?: number,
 *   moves: Move[]
 * }} Position
 *
 * @typedef {{
 *   id: string,
 *   positions: Position[],
 *   currentPosition: number[]
 * }} Game
 */
