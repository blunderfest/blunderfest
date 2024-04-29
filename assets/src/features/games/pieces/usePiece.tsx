import { Piece } from "@/types";
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

export function usePiece(piece: Piece) {
  const { t } = useTranslation();

  switch (piece) {
    case "k": {
      return {
        title: t("pieces.black.king"),
        Element: <BlackKing />,
      };
    }
    case "K": {
      return {
        title: t("pieces.white.king"),
        Element: <WhiteKing />,
      };
    }
    case "q": {
      return {
        title: t("pieces.black.queen"),
        Element: <BlackQueen />,
      };
    }
    case "Q": {
      return {
        title: t("pieces.white.queen"),
        Element: <WhiteQueen />,
      };
    }
    case "r": {
      return {
        title: t("pieces.black.rook"),
        Element: <BlackRook />,
      };
    }
    case "R": {
      return {
        title: t("pieces.white.rook"),
        Element: <WhiteRook />,
      };
    }
    case "b": {
      return {
        title: t("pieces.black.bishop"),
        Element: <BlackBishop />,
      };
    }
    case "B": {
      return {
        title: t("pieces.white.bishop"),
        Element: <WhiteBishop />,
      };
    }
    case "n": {
      return {
        title: t("pieces.black.knight"),
        Element: <BlackKnight />,
      };
    }
    case "N": {
      return {
        title: t("pieces.white.knight"),
        Element: <WhiteKnight />,
      };
    }
    case "p": {
      return {
        title: t("pieces.black.pawn"),
        Element: <BlackPawn />,
      };
    }
    case "P": {
      return {
        title: t("pieces.white.pawn"),
        Element: <WhitePawn />,
      };
    }
  }
}
