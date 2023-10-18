import { useAppDispatch, useAppSelector } from "@/store";
import { useRef } from "react";
import { useClickAway, useKey } from "react-use";
import { css } from "styled-system/css";
import { Grid } from "styled-system/jsx/grid";
import { deselect, selectCurrentPosition } from "../games/gamesSlice";
import { Square } from "./Square";

export function Board() {
  const board = useAppSelector(selectCurrentPosition);
  const dispatch = useAppDispatch();
  const ref = useRef(null);
  const squareRefs = useRef([...Array.from({ length: 64 })]);

  useClickAway(ref, (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    if (!target || !target.onclick || typeof target.onclick !== "function") {
      dispatch(deselect());
    }
  });

  const focus = (/** @type {number} */ delta) => {
    const refs = squareRefs.current;

    const index = refs.findIndex((ref) => ref === document.activeElement);

    if (index !== -1) {
      const nextIndex = (index + delta + 64) % 64;
      const ref = refs[nextIndex];

      ref.focus();
    }
  };

  useKey("ArrowUp", () => focus(-8));
  useKey("ArrowDown", () => focus(8));
  useKey("ArrowLeft", () => focus(-1));
  useKey("ArrowRight", () => focus(1));

  if (!board) {
    return <>Loading...</>;
  }

  return (
    <Grid
      ref={ref}
      columns={8}
      rowGap={0}
      columnGap={0}
      height={{
        base: "auto",
        lg: "100vh",
      }}
      width={{
        base: "100vw",
        lg: "auto",
      }}
      aspectRatio="square"
      position="relative"
    >
      {board.squares.map((square, index) => (
        <Square
          key={square.squareIndex}
          ref={(node) => (squareRefs.current[index] = node)}
          square={square}
          highlighted={board.selectedSquare === square.squareIndex}
        />
      ))}
      <div
        className={css({
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: "marble",
          filter: "opacity(0.1)",
          pointerEvents: "none",
        })}
      ></div>
    </Grid>
  );
}
