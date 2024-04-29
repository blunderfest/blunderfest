import { Piece, SquareIndex } from "@/types";
import { useDraggable } from "@dnd-kit/core";
import { tv } from "tailwind-variants";
import { usePiece } from "./pieces/usePiece";

const recipe = tv({
  base: "relative z-0 cursor-grab touch-none outline-none",
  variants: {
    isDragging: {
      true: "z-50",
    },
  },
});
export function SvgPiece(props: Readonly<{ squareIndex: SquareIndex; piece: Piece }>) {
  const info = usePiece(props.piece);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `square-${props.squareIndex}`,
    data: {
      squareIndex: props.squareIndex,
    },
  });

  const classes = recipe({
    isDragging: isDragging,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  if (!info) {
    return null;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={classes}
      // @ts-ignore
      ref={(ref) => setNodeRef(ref)}
      style={style}
      {...attributes}
      {...listeners}
      viewBox="0 0 45 45"
      pointerEvents="none">
      <title>{info.title}</title>
      {info.Element}
    </svg>
  );
}
