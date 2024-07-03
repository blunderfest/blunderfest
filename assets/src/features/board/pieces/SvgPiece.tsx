import { pieces } from "./pieces";
import { tv } from "tailwind-variants";
import { useTranslation } from "react-i18next";
import { UseDroppableArguments, useDraggable } from "@dnd-kit/core";
import { useId } from "react";

const recipe = tv({
  base: "relative z-0 cursor-grab touch-none outline-none hover:scale-110",
  variants: {
    dragging: {
      true: "z-50",
    },
  },
});

export function SvgPiece(props: Readonly<{ data: UseDroppableArguments["data"]; piece: string | null }>) {
  const info = pieces.get(props.piece);
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

  const className = recipe({
    dragging: isDragging,
  });

  if (!info) {
    return null;
  }

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
      <title>{t(info.title)}</title>
      {info.Element}
    </svg>
  );
}
