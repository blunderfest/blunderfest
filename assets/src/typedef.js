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
 * @typedef {{
 *   square_index: number,
 *   color: "light" | "dark"
 * }} Square
 */

/**
 * @typedef {{
 *  squares: Square[],
 *  selectedSquare: number | undefined,
 *  markedSquares: number[]
 * }} Board
 */
