import { useAppDispatch, useAppSelector } from "@/store";
import { reset } from "@/store/positions";
import { useMemo, useRef } from "react";
import { useClickAway } from "react-use";
import { Grid } from "styled-system/jsx";
import { parseFen } from "../parsers/parseFen";
import { Square } from "./Square";
import { useBoardAria } from "./aria";

/**
 * @param {{
 *   positionId: string
 * }} props
 * @returns
 */
export function Board(props) {
  const { positionId } = props;

  const dispatch = useAppDispatch();
  const position = useAppSelector((state) => state.position.byId[positionId]);
  const squares = useMemo(() => parseFen(position.fen).squares, [position.fen]);

  const ref = useRef(null);
  useClickAway(ref, (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    if (!target || !target.onclick || typeof target.onclick !== "function") {
      dispatch(reset(positionId));
    }
  });

  const { squareRefs, keyboardProps } = useBoardAria();

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
      {squares.map((square, index) => (
        <Square
          key={square.file + square.rank}
          ref={(node) => (squareRefs.current[index] = node)}
          positionId={positionId}
          parsedSquare={square}
        />
      ))}
    </Grid>
  );
}
