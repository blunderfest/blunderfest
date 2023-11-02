import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

/**
 * @param {React.PropsWithChildren & {id: string, data: import("@dnd-kit/core").Data, recipe: (dragging: boolean) => string}} props
 * @returns
 */
export function Draggable(props) {
  const { id, data, recipe } = props;

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: id,
    data: data,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={style} className={recipe(isDragging)}>
      {props.children}
    </div>
  );
}
