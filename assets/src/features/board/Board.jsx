import { useAppDispatch, useAppSelector } from "@/store";
import { movePiece } from "@/store/actions";
import { DndContext } from "@dnd-kit/core";
import { Grid } from "styled-system/jsx";
import { Square } from "./Square";
import { useBoardAria } from "./aria";

/**
 * @param {{
 *   gameCode: string,
 * }} props
 */
export function Board(props) {
  const { gameCode } = props;
  const positionId = useAppSelector((state) => state.game.entities[gameCode]?.currentPositionId) ?? "";

  const dispatch = useAppDispatch();
  const position = useAppSelector((state) => state.position.entities[positionId]);

  const { keyboardProps } = useBoardAria();

  /**
   * @param {import("@dnd-kit/core").DragEndEvent} event
   */
  function handleDragEnd(event) {
    const { active, over } = event;

    if (over) {
      const from = Number(active.id);
      const to = Number(over.id);

      if (from !== to) {
        dispatch(
          movePiece(gameCode, positionId, {
            from: from,
            to: to,
          }),
        );
      }
    }
  }

  return (
    <DndContext onDragEnd={(e) => handleDragEnd(e)}>
      <Grid
        role="grid"
        {...keyboardProps}
        aria-colcount={8}
        aria-rowcount={8}
        columns={8}
        gap={0}
        height={"100vh"}
        aspectRatio="square">
        {position?.squares.map((square) => (
          <Square key={square.file + square.rank} positionId={positionId} parsedSquare={square} />
        ))}
      </Grid>
    </DndContext>
  );
}
