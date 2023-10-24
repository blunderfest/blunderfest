import { useAppDispatch, useAppSelector } from "@/store";
import { reset } from "@/store/board";
import { useRef } from "react";
import { useKeyboard } from "react-aria";
import { useClickAway } from "react-use";
import { Grid } from "styled-system/jsx/grid";
import { parseFen } from "../parsers/parseFen";
import { Square } from "./Square";

export function Board() {
  const dispatch = useAppDispatch();

  const ref = useRef(null);
  const squareRefs = useRef([...Array.from({ length: 64 })]);

  useClickAway(ref, (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    if (!target || !target.onclick || typeof target.onclick !== "function") {
      dispatch(reset());
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

  const activeGame = useAppSelector((state) => state.game.games[state.room.activeGame]);

  if (!activeGame) {
    return <>Loading...</>;
  }

  const position = parseFen(activeGame.positions[0].fen);

  return (
    <Grid
      role="grid"
      aria-colcount={8}
      aria-rowcount={8}
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
      {...keyboardProps}
    >
      {position.squares.map((square, index) => (
        <Square key={square.squareIndex} ref={(node) => (squareRefs.current[index] = node)} square={square} />
      ))}
    </Grid>
  );
}
