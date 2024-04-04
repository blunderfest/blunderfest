import { useDraggable } from "@dnd-kit/core";
import { tv } from "tailwind-variants";
import { usePiece } from "./pieces/usePiece";

const recipe = tv({
  base: "relative z-0 cursor-default",
  variants: {
    isDragging: {
      true: "z-50",
    },
  },
});

/**
 * @param {{
 *   squareIndex: SquareIndex,
 *   piece: Piece
 * }} props
 */
export function SvgPiece(props) {
  const { squareIndex, piece } = props;

  const info = usePiece(piece);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `square-${squareIndex}`,
    data: {
      squareIndex: squareIndex,
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
    <div className={classes} style={style} {...attributes}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 45 45"
        pointerEvents="none"
        className="cursor-grab touch-none "
        // @ts-ignore
        ref={(ref) => setNodeRef(ref)}
        {...listeners}>
        <title>{info.title}</title>
        {info.Element}
      </svg>
    </div>
  );
}
