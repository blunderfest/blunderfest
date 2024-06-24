/**
 * @typedef {Object} Meta
 * @property {string} phxRef
 * @property {string} onlineAt
 *
 * @typedef {Object} Presence
 * @property {Meta[]} metas
 */

/**
 * @typedef {Object} Room
 * @property {string} roomCode
 * @property {number} timestamp
 * @property {Record<string, Record<string, Meta>>} users
 */
