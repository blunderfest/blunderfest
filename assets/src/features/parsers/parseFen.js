/**
 * @param {string} san
 * @returns {Piece | undefined}
 */
function sanToPiece(san) {
  switch (san) {
    case "P":
      return { color: "white", piece: "pawn" };
    case "N":
      return { color: "white", piece: "knight" };
    case "B":
      return { color: "white", piece: "bishop" };
    case "R":
      return { color: "white", piece: "rook" };
    case "K":
      return { color: "white", piece: "king" };
    case "Q":
      return { color: "white", piece: "queen" };
    case "p":
      return { color: "black", piece: "pawn" };
    case "n":
      return { color: "black", piece: "knight" };
    case "b":
      return { color: "black", piece: "bishop" };
    case "r":
      return { color: "black", piece: "rook" };
    case "k":
      return { color: "black", piece: "king" };
    case "q":
      return { color: "black", piece: "queen" };
    default:
      return undefined;
  }
}

/**
 * @param {number} rankIndex
 * @param {string} rank
 * @returns {Square[]}
 */
function parseRank(rankIndex, rank) {
  /**
   * @type {Array<Piece | undefined>}
   */
  const pieces = rank.split("").flatMap((san) => {
    const piece = sanToPiece(san);

    if (piece) {
      return piece;
    }

    const emptySquares = Number(san);

    if (emptySquares > 0) {
      return [...Array.from({ length: Number(san) })].map(() => undefined);
    }

    return undefined;
  });

  return pieces.map((piece, fileIndex) => ({
    squareIndex: rankIndex + 8 * fileIndex,
    file: String.fromCharCode(97 + fileIndex),
    rank: rankIndex + 1,
    color: fileIndex % 2 === rankIndex % 2 ? "light" : "dark",
    mark: "none",
    piece: piece,
  }));
}

/**
 * @param {string} fen
 * @returns {Position}
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
