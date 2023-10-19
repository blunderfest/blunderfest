import { deselect, selectCurrentPosition } from "@/features/games";
import { useAppDispatch, useAppSelector } from "@/store";
import { useRef } from "react";
import { useKeyboard } from "react-aria";
import { useClickAway } from "react-use";

export const useBoard = () => {
  const ref = useRef(null);
  const squareRefs = useRef([...Array.from({ length: 64 })]);

  useClickAway(ref, (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    if (!target || !target.onclick || typeof target.onclick !== "function") {
      dispatch(deselect());
    }
  });

  const board = useAppSelector(selectCurrentPosition);
  const dispatch = useAppDispatch();

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
    board,
    boardRef: ref,
    squareRefs,
    keyboardProps,
  };
};
