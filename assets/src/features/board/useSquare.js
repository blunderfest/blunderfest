import { useAppDispatch } from "@/store";
import { useFocusRing, useKeyboard, usePress } from "react-aria";
import { mark, select, unmark } from "../games/gamesSlice";
import { squareRecipe } from "./squareRecipe";
import { useBoard } from "./useBoard";

export const useSquare = (/** @type {Square} */ square) => {
  const { board } = useBoard();
  const dispatch = useAppDispatch();

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        if (e.ctrlKey) {
          cycle();
        } else {
          onSelect();
        }
      } else {
        e.continuePropagation();
      }
    },
  });

  const { pressProps } = usePress({
    onPress: () => {
      dispatch(select({ squareIndex: square.squareIndex }));
    },
  });

  const { focusProps, isFocusVisible } = useFocusRing({
    within: true,
  });

  const classes = squareRecipe({
    focussed: isFocusVisible,
    color: square.color,
    selected: square.mark,
  });

  const onSelect = () => dispatch(select({ squareIndex: square.squareIndex }));
  const onMark = (/** @type {boolean} */ alt, /** @type {boolean} */ ctrl) =>
    dispatch(
      mark({
        squareIndex: square.squareIndex,
        alt: alt,
        ctrl: ctrl,
      }),
    );

  const cycle = () => {
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

  return {
    label: square.file + square.rank,
    selected: board?.selectedSquare === square.squareIndex,
    classes,
    keyboardProps,
    pressProps,
    focusProps,
    onSelect,
    onMark,
    piece: square.piece,
  };
};
