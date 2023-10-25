/**
 * @param {number} rankIndex
 * @param {string} rank
 * @returns {ParsedSquare[]}
 */
function parseRank(rankIndex, rank) {
  const pieces = rank.split("").flatMap((piece) => {
    const emptySquares = Number(piece);

    if (emptySquares > 0) {
      return [...Array.from({ length: emptySquares })].map(() => null);
    }

    return /** @type {Piece} */ (piece);
  });

  return pieces.map((piece, fileIndex) => ({
    squareIndex: rankIndex + 8 * fileIndex,
    file: String.fromCharCode(97 + fileIndex),
    rank: rankIndex + 1,
    color: fileIndex % 2 === rankIndex % 2 ? "white" : "black",
    piece: piece,
  }));
}

/**
 * @param {string} fen
 * @returns {ParsedPosition}
 */
export function parseFen(fen) {
  const [piecePlacement, activeColor, castlingAvailability, enPassant, halfmoveClock, fullmoveNumber] = fen.split(" ");

  const ranks = piecePlacement.split("/");

  return {
    squares: ranks.flatMap((rank, index) => parseRank(7 - index, rank)),
    activeColor: activeColor === "w" ? "white" : "black",
    castlingAvailability: castlingAvailability === "-" ? [] : castlingAvailability.split(""),
    enPassant: enPassant === "-" ? null : enPassant[0].charCodeAt(0) - 97 + (Number(enPassant[1]) - 1) * 8,
    halfmoveClock: Number(halfmoveClock),
    fullmoveNumber: Number(fullmoveNumber),
  };
}
