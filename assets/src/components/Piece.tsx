import { css } from "@design-system/css";
import { useDraggable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { BlackBishop } from "./pieces/BlackBishop";
import { BlackKing } from "./pieces/BlackKing";
import { BlackKnight } from "./pieces/BlackKnight";
import { BlackPawn } from "./pieces/BlackPawn";
import { BlackQueen } from "./pieces/BlackQueen";
import { BlackRook } from "./pieces/BlackRook";
import { WhiteBishop } from "./pieces/WhiteBishop";
import { WhiteKing } from "./pieces/WhiteKing";
import { WhiteKnight } from "./pieces/WhiteKnight";
import { WhitePawn } from "./pieces/WhitePawn";
import { WhiteQueen } from "./pieces/WhiteQueen";
import { WhiteRook } from "./pieces/WhiteRook";

function usePiece(piece: "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P") {
  const { t } = useTranslation("pieces", { useSuspense: false });

  switch (piece) {
    case "k": {
      return {
        title: t("black.king"),
        Element: <BlackKing />,
      };
    }
    case "K": {
      return {
        title: t("white.king"),
        Element: <WhiteKing />,
      };
    }
    case "q": {
      return {
        title: t("black.queen"),
        Element: <BlackQueen />,
      };
    }
    case "Q": {
      return {
        title: t("white.queen"),
        Element: <WhiteQueen />,
      };
    }
    case "r": {
      return {
        title: t("black.rook"),
        Element: <BlackRook />,
      };
    }
    case "R": {
      return {
        title: t("white.rook"),
        Element: <WhiteRook />,
      };
    }
    case "b": {
      return {
        title: t("black.bishop"),
        Element: <BlackBishop />,
      };
    }
    case "B": {
      return {
        title: t("white.bishop"),
        Element: <WhiteBishop />,
      };
    }
    case "n": {
      return {
        title: t("black.knight"),
        Element: <BlackKnight />,
      };
    }
    case "N": {
      return {
        title: t("white.knight"),
        Element: <WhiteKnight />,
      };
    }
    case "p": {
      return {
        title: t("black.pawn"),
        Element: <BlackPawn />,
      };
    }
    case "P": {
      return {
        title: t("white.pawn"),
        Element: <WhitePawn />,
      };
    }
  }
}

type Props = {
  squareIndex: number;
  piece: "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P";
};
export function Piece(props: Readonly<Props>) {
  const { squareIndex, piece } = props;

  const info = usePiece(piece);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `square-${squareIndex}`,
    data: {
      squareIndex: squareIndex,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 45 45"
      pointerEvents="none"
      cursor="grab"
      ref={(ref) => setNodeRef(ref as unknown as HTMLElement)}
      style={style}
      className={css({
        zIndex: isDragging ? "important" : "1",
        touchAction: "none",
        position: "relative",
      })}
      {...attributes}
      {...listeners}>
      <title>{info.title}</title>
      {info.Element}
    </svg>
  );
}
