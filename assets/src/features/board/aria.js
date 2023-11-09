import { useAppDispatch, useAppSelector } from "@/store";
import { markSquare, resetPosition, selectSquare } from "@/store/actions";
import { useRef } from "react";
import { mergeProps, useFocusRing, useKeyboard, useLongPress, usePress } from "react-aria";

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
 * @param {string} positionId
 * @param {ParsedSquare} square
 */
export const useSquareAria = (positionId, square) => {
  const dispatch = useAppDispatch();
  const mark = useAppSelector((state) => state.marks.byPositionId[positionId][square.squareIndex]);

  /**
   * @returns {Mark}
   */
  const nextMark = () => {
    switch (mark) {
      case undefined:
      case "none":
        return "simple";
      case "simple":
        return "alt";
      case "alt":
        return "ctrl";
      case "ctrl":
        return "none";
      default:
        return "none";
    }
  };

  const { longPressProps } = useLongPress({
    onLongPress: () => {
      dispatch(markSquare(positionId, square.squareIndex, nextMark()));
    },
  });

  const { pressProps } = usePress({
    onPress: (e) => {
      if (e.pointerType === "keyboard" && e.ctrlKey) {
        dispatch(markSquare(positionId, square.squareIndex, nextMark()));
      } else if (square.piece && (mark === undefined || mark === "none")) {
        dispatch(selectSquare(positionId, square.squareIndex));
      } else {
        dispatch(resetPosition(positionId));
      }
    },
  });

  const { focusProps, isFocusVisible } = useFocusRing({
    within: true,
  });

  return {
    elementProps: mergeProps(longPressProps, pressProps, focusProps),
    isFocusVisible,
  };
};
