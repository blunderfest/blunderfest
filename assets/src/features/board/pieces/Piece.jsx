import { useTranslation } from "react-i18next";
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

const mapping = {
  black: {
    bishop: BlackBishop,
    king: BlackKing,
    knight: BlackKnight,
    pawn: BlackPawn,
    queen: BlackQueen,
    rook: BlackRook,
  },
  white: {
    bishop: WhiteBishop,
    king: WhiteKing,
    knight: WhiteKnight,
    pawn: WhitePawn,
    queen: WhiteQueen,
    rook: WhiteRook,
  },
};

/**
 * @param {Piece} props
 */
export function Piece({ piece, color }) {
  const { t } = useTranslation("board");

  const Svg = mapping[color][piece];

  return <Svg width="100%" height="100%" viewBox="0 0 45 45" title={t(`${color}_${piece}`)} />;
}
