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
  b: BlackBishop,
  k: BlackKing,
  n: BlackKnight,
  p: BlackPawn,
  q: BlackQueen,
  r: BlackRook,
  B: WhiteBishop,
  K: WhiteKing,
  N: WhiteKnight,
  P: WhitePawn,
  Q: WhiteQueen,
  R: WhiteRook,
};

/**
 * @param {{piece: Piece}} props
 */
export function Piece(props) {
  const { piece } = props;
  const { t } = useTranslation("board");

  const Svg = mapping[piece];

  return <Svg width="100%" height="100%" viewBox="0 0 45 45" title={t(`piece_${piece}`)} />;
}
