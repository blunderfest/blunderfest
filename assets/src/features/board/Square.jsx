import { useAppDispatch } from "@/store";
import { mark, select, unmark } from "../games/gamesSlice";
import { Piece } from "./pieces/Piece";
import { squareRecipe } from "./squareRecipe";

/**
 * @param {{
 *   square: Square,
 *   highlighted: boolean,
 * }} props
 */

export const Square = (props) => {
  const { square, highlighted } = props;

  const classes = squareRecipe({
    color: square.color,
    selected: square.mark !== "none" ? square.mark : highlighted ? "highlighted" : "none",
  });

  const dispatch = useAppDispatch();

  const onSelect = () => dispatch(select({ squareIndex: square.squareIndex }));
  const onMark = (/** @type {boolean} */ alt, /** @type {boolean} */ ctrl) =>
    dispatch(
      mark({
        squareIndex: square.squareIndex,
        alt: alt,
        ctrl: ctrl,
      }),
    );
  const iterate = () => {
    const marks = ["none", "simple", "alt", "ctrl"];
    const currentMark = marks.indexOf(square.mark);
    const nextMark = marks[(currentMark + 1) % marks.length];

    if (nextMark === "none") {
      dispatch(
        unmark({
          squareIndex: square.squareIndex,
        }),
      );
    } else {
      dispatch(
        mark({
          squareIndex: square.squareIndex,
          alt: nextMark === "alt",
          ctrl: nextMark === "ctrl",
        }),
      );
    }
  };

  return (
    <div
      tabIndex={square.squareIndex + 1}
      role="button"
      className={classes.root}
      onClick={onSelect}
      onContextMenu={(e) => onMark(e.altKey, e.ctrlKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.ctrlKey) {
            iterate();
          } else {
            onSelect();
          }
        }
      }}
    >
      <div className={classes.selection}>&nbsp;</div>
      <div className={classes.piece}>{square.piece && <Piece {...square.piece} />}</div>
    </div>
  );
};
