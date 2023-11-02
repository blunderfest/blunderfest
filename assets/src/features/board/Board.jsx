import { useAppDispatch, useAppSelector } from "@/store";
import { move } from "@/store/games";
import { reset } from "@/store/positions";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useMemo, useRef, useState } from "react";
import { useClickAway } from "react-use";
import { Grid } from "styled-system/jsx";
import { parseFen } from "../parsers/parseFen";
import { Square } from "./Square";
import { useBoardAria } from "./aria";
import { Piece } from "./pieces/Piece";

/**
 * @param {{
 *   gameId: string,
 *   positionId: string
 * }} props
 * @returns
 */
export function Board(props) {
  const { gameId, positionId } = props;

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
  const [draggedPiece, setDraggedPiece] = useState(/** @type {Piece | undefined} */ (undefined));

  /**
   * @param {import("@dnd-kit/core").DragEndEvent} event
   */
  function handleDragEnd(event) {
    setDraggedPiece(undefined);

    const { active, over } = event;

    if (over) {
      const from = active.id;
      const to = over.id;

      dispatch(
        move(gameId, positionId, {
          from: Number(from),
          to: Number(to),
        }),
      );
    }
  }

  return (
    <DndContext onDragStart={(e) => setDraggedPiece(e.active.data.current?.piece)} onDragEnd={(e) => handleDragEnd(e)}>
      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
        }}
        zIndex={1000}
      >
        {draggedPiece ? <Piece piece={draggedPiece} /> : null}
      </DragOverlay>

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
            setNodeRef={(node) => (squareRefs.current[index] = node)}
            positionId={positionId}
            parsedSquare={square}
          />
        ))}
      </Grid>
    </DndContext>
  );
}
