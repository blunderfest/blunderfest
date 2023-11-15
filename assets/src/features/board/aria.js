import { useFocusManager } from "@/aria/focusManager";
import { useAppDispatch, useAppSelector } from "@/store";
import { deselectSquare, markSquare, resetPosition, selectSquare } from "@/store/actions";
import { mergeProps, useFocusRing, useLongPress, usePress } from "react-aria";

export const useBoardAria = () => {
  const focusManager = useFocusManager({
    accept: (node) => node.getAttribute("role") === "gridcell",
    amountUp: 8,
    amountDown: 8,
  });

  return focusManager;
};

/**
 * @param {string} positionId
 * @param {ParsedSquare} square
 */
export const useSquareAria = (positionId, square) => {
  const dispatch = useAppDispatch();
  const mark = useAppSelector((state) => state.marks.byPositionId[positionId][square.squareIndex]);
  const position = useAppSelector((state) => state.position.entities[positionId]);

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
      } else if (square.squareIndex === position?.selectedSquareIndex) {
        dispatch(deselectSquare(positionId, square.squareIndex));
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
