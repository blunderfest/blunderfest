import { forwardRef } from "react";
import { Grid } from "styled-system/jsx/grid";
import { Square } from "./Square";
import { useBoardAria } from "./aria";

export const Board = forwardRef(
  /**
   * @param {{position: Position}} props
   * @param {import("react").Ref<HTMLDivElement>} ref
   */
  (props, ref) => {
    const { position } = props;
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
        {position.squares.map((square, index) => (
          <Square key={square.squareIndex} ref={(node) => (squareRefs.current[index] = node)} square={square} />
        ))}
      </Grid>
    );
  },
);

Board.displayName = "Board";
