import * as pieceComponents from "./pieces";
import { useTranslation } from "react-i18next";
import { UseDroppableArguments, useDraggable } from "@dnd-kit/core";
import { memo, useId } from "react";
import { pieceRecipe } from "./pieceRecipe";

const pieces: Record<string, () => JSX.Element> = {
  k: pieceComponents.BlackKing,
  K: pieceComponents.WhiteKing,
  q: pieceComponents.BlackQueen,
  Q: pieceComponents.WhiteQueen,
  r: pieceComponents.BlackRook,
  R: pieceComponents.WhiteRook,
  b: pieceComponents.BlackBishop,
  B: pieceComponents.WhiteBishop,
  n: pieceComponents.BlackKnight,
  N: pieceComponents.WhiteKnight,
  p: pieceComponents.BlackPawn,
  P: pieceComponents.WhitePawn,
};

export const Piece = memo((props: Readonly<{ data: UseDroppableArguments["data"]; piece: string }>) => {
  const element = pieces[props.piece];
  const { t } = useTranslation();

  const id = useId();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: props.data,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const className = pieceRecipe({
    dragging: isDragging,
  });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      ref={(e) => setNodeRef(e as unknown as HTMLElement)}
      style={style}
      {...listeners}
      {...attributes}
      className={className}
      viewBox="0 0 45 45"
      pointerEvents="none">
      <title>{t(`pieces.${props.piece}`)}</title>
      {element()}
    </svg>
  );
});
