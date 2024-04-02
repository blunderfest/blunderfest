/**
 * @typedef {"k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P"} Piece
 */

/**
 * @typedef {number} SquareIndex
 */

/**
 * @typedef {"dark" | "light"} Color
 */

/**
 * @typedef {Object} Square
 * @property {SquareIndex} squareIndex
 * @property {Color} color
 * @property {Piece | null} piece
 */

/**
 * @typedef {Object} Move
 * @property {Square} from
 * @property {Square} to
 * @property {Piece | null} promotion
 */

/**
 * @typedef {Object} Variation
 * @property {string} position
 * @property {Move | null} move
 * @property {Variation[]} variations
 */

/**
 * @typedef {Object} Game
 * @property {Variation[]} variations
 * @property {string} gameCode
 * @property {Square[]} squares
 */
