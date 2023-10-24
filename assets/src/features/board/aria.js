import { useAppDispatch, useAppSelector } from "@/store";
import { mark, reset, select, selectHasMarks } from "@/store/board";
import { useRef } from "react";
import { mergeProps, useFocusRing, useKeyboard, useLongPress, usePress } from "react-aria";
import { useSelector } from "react-redux";

export const useBoardAria = () => {
  const squareRefs = useRef([...Array.from({ length: 64 })]);

  const focus = (/** @type {number} */ delta) => {
    const refs = squareRefs.current;

    const index = refs.findIndex((ref) => ref === document.activeElement);

    if (index !== -1) {
      const nextIndex = (index + delta + 64) % 64;
      const ref = refs[nextIndex];

      ref.focus();
    }
  };

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === "ArrowUp") {
        focus(-8);
      } else if (e.key === "ArrowDown") {
        focus(8);
      } else if (e.key === "ArrowLeft") {
        focus(-1);
      } else if (e.key === "ArrowRight") {
        focus(1);
      } else {
        e.continuePropagation();
      }
    },
  });

  return {
    keyboardProps,
    squareRefs,
  };
};

/**
 * @param {Square} square
 */
export const useSquareAria = (square) => {
  const dispatch = useAppDispatch();
  const board = useAppSelector((state) => state.board);
  const hasMarks = useSelector(selectHasMarks);

  const { longPressProps } = useLongPress({
    onLongPress: () => {
      dispatch(mark(square.squareIndex, nextMark()));
    },
  });

  const { pressProps } = usePress({
    onPress: (e) => {
      if (e.pointerType === "keyboard" && e.ctrlKey) {
        dispatch(mark(square.squareIndex, nextMark()));
      } else if (square.piece && !hasMarks) {
        dispatch(select(square.squareIndex));
      } else {
        dispatch(reset());
      }
    },
  });

  const { focusProps, isFocusVisible } = useFocusRing({
    within: true,
  });

  /**
   * @returns {Mark}
   */
  const nextMark = () => {
    switch (board.marks[square.squareIndex]) {
      case "none":
        return "simple";
      case "simple":
        return "alt";
      case "alt":
        return "ctrl";
      case "ctrl":
        return "none";
    }
  };

  return {
    elementProps: mergeProps(longPressProps, pressProps, focusProps),
    isFocusVisible,
  };
};
