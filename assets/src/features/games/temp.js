const files = [...Array.from({ length: 8 }).keys()];
const ranks = [...Array.from({ length: 8 }).keys()].reverse();

/** @type {Array<Piece | undefined>} */
const pieces = [...Array.from({ length: 64 }).keys()].map((squareIndex) => {
  switch (squareIndex) {
    case 0:
      return { color: "white", piece: "rook" };
    case 1:
      return { color: "white", piece: "knight" };
    case 2:
      return { color: "white", piece: "bishop" };
    case 3:
      return { color: "white", piece: "queen" };
    case 4:
      return { color: "white", piece: "king" };
    case 5:
      return { color: "white", piece: "bishop" };
    case 6:
      return { color: "white", piece: "knight" };
    case 7:
      return { color: "white", piece: "rook" };

    case 8:
      return { color: "white", piece: "pawn" };
    case 9:
      return { color: "white", piece: "pawn" };
    case 10:
      return { color: "white", piece: "pawn" };
    case 11:
      return { color: "white", piece: "pawn" };
    case 12:
      return { color: "white", piece: "pawn" };
    case 13:
      return { color: "white", piece: "pawn" };
    case 14:
      return { color: "white", piece: "pawn" };
    case 15:
      return { color: "white", piece: "pawn" };

    case 56:
      return { color: "black", piece: "rook" };
    case 57:
      return { color: "black", piece: "knight" };
    case 58:
      return { color: "black", piece: "bishop" };
    case 59:
      return { color: "black", piece: "queen" };
    case 60:
      return { color: "black", piece: "king" };
    case 61:
      return { color: "black", piece: "bishop" };
    case 62:
      return { color: "black", piece: "knight" };

    case 63:
      return { color: "black", piece: "rook" };
    case 48:
      return { color: "black", piece: "pawn" };
    case 49:
      return { color: "black", piece: "pawn" };
    case 50:
      return { color: "black", piece: "pawn" };
    case 51:
      return { color: "black", piece: "pawn" };
    case 52:
      return { color: "black", piece: "pawn" };
    case 53:
      return { color: "black", piece: "pawn" };
    case 54:
      return { color: "black", piece: "pawn" };
    case 55:
      return { color: "black", piece: "pawn" };
    default: {
      return undefined;
    }
  }
});

/**
 * @returns {Position}
 */
export function newPosition() {
  return {
    squares: ranks.flatMap((rank) =>
      files.map((file) => ({
        squareIndex: rank * 8 + file,
        file: String.fromCharCode(97 + file),
        rank: rank + 1,
        color: file % 2 === rank % 2 ? "light" : "dark",
        mark: "none",
        piece: pieces[rank * 8 + file],
      })),
    ),
    selectedSquare: undefined,
  };
}
