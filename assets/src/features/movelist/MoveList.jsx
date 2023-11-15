import { useFocusManager } from "@/aria/focusManager";
import { useAppDispatch, useAppSelector } from "@/store";
import { selectPosition } from "@/store/actions/selectPosition";
import { selectVariation } from "@/store/variationReducer";
import { Fragment } from "react";
import { cva } from "styled-system/css";
import { Grid, GridItem } from "styled-system/jsx";

const move = cva({
  base: {},
  variants: {
    selected: {
      true: {
        backgroundColor: "primary",
        color: "secondary",
      },
    },
  },
});

/**
 * @param {{
 *   gameId: string,
 * }} props
 */
export function MoveList(props) {
  const { gameId } = props;

  const variations = useAppSelector((state) => selectVariation(state, gameId));
  const positionId = useAppSelector((state) => state.game.entities[gameId]?.currentPositionId) ?? "";
  const dispatch = useAppDispatch();

  const focusManager = useFocusManager({
    accept: (node) => node.hasAttribute("data-position-id"),
    onFocus: (node) => {
      const positionId = node.getAttribute("data-position-id");

      if (positionId) {
        dispatch(selectPosition(gameId, positionId));
      }
    },
    amountUp: 2,
    amountDown: 2,
  });

  return (
    <Grid {...focusManager.keyboardProps} role="treegrid" columns={3} gap={0} backgroundColor="surface.2" color="text.2">
      <GridItem>#</GridItem>
      <GridItem>W</GridItem>
      <GridItem>B</GridItem>

      {variations.map((variant, index) => (
        <Fragment key={variant.positionId}>
          {index % 2 === 0 && <GridItem>{Math.floor(index / 2) + 1}</GridItem>}
          <GridItem
            data-position-id={variant.positionId}
            tabIndex={0}
            className={move({ selected: variant.positionId === positionId })}
            onClick={() => dispatch(selectPosition(gameId, variant.positionId))}>
            {variant.positionId}
          </GridItem>
        </Fragment>
      ))}
    </Grid>
  );
}
