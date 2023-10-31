import { useAppDispatch, useAppSelector } from "@/store";
import { mark, select } from "@/store/positions";
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
  const position = useAppSelector((state) => state.position.byId[positionId]);
  const hasMarks = useAppSelector((state) => state.position.byId[positionId].marks.findIndex((mark) => mark !== "none") !== -1);

  /**
   * @returns {Mark}
   */
  const nextMark = () => {
    switch (position.marks[square.squareIndex]) {
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

  const { longPressProps } = useLongPress({
    onLongPress: () => {
      dispatch(mark(positionId, square.squareIndex, nextMark()));
    },
  });

  const { pressProps } = usePress({
    onPress: (e) => {
      if (e.pointerType === "keyboard" && e.ctrlKey) {
        dispatch(mark(positionId, square.squareIndex, nextMark()));
      } else if (square.piece && !hasMarks) {
        dispatch(select(positionId, square.squareIndex));
      } else {
        dispatch(select(positionId, square.squareIndex));
        // dispatch(reset(positionId));
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
