import { BlackBishop } from "./BlackBishop";
import { BlackKing } from "./BlackKing";
import { BlackKnight } from "./BlackKnight";
import { BlackPawn } from "./BlackPawn";
import { BlackQueen } from "./BlackQueen";
import { BlackRook } from "./BlackRook";
import { WhiteBishop } from "./WhiteBishop";
import { WhiteKing } from "./WhiteKing";
import { WhiteKnight } from "./WhiteKnight";
import { WhitePawn } from "./WhitePawn";
import { WhiteQueen } from "./WhiteQueen";
import { WhiteRook } from "./WhiteRook";

type T = { title: string; Element: JSX.Element };

export const pieces = new Map<string | null, T | null>([
  [
    "k",
    {
      title: "pieces.black.king",
      Element: <BlackKing />,
    },
  ],
  [
    "K",
    {
      title: "pieces.white.king",
      Element: <WhiteKing />,
    },
  ],
  [
    "q",
    {
      title: "pieces.black.queen",
      Element: <BlackQueen />,
    },
  ],
  [
    "Q",
    {
      title: "pieces.white.queen",
      Element: <WhiteQueen />,
    },
  ],
  [
    "r",
    {
      title: "pieces.black.rook",
      Element: <BlackRook />,
    },
  ],
  [
    "R",
    {
      title: "pieces.white.rook",
      Element: <WhiteRook />,
    },
  ],
  [
    "b",
    {
      title: "pieces.black.bishop",
      Element: <BlackBishop />,
    },
  ],
  [
    "B",
    {
      title: "pieces.white.bishop",
      Element: <WhiteBishop />,
    },
  ],
  [
    "n",
    {
      title: "pieces.black.knight",
      Element: <BlackKnight />,
    },
  ],
  [
    "N",
    {
      title: "pieces.white.knight",
      Element: <WhiteKnight />,
    },
  ],
  [
    "p",
    {
      title: "pieces.black.pawn",
      Element: <BlackPawn />,
    },
  ],
  [
    "P",
    {
      title: "pieces.white.pawn",
      Element: <WhitePawn />,
    },
  ],
  [null, null],
]);
