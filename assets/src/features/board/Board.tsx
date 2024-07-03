import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { Square } from "./Square";
import { selectSquares } from "./boardSlice";
import { useKey } from "react-use";
import { flipBoard, move } from "@/store/actions";
import {
  DataRef,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { memo } from "react";

function isValidDragData(data: unknown): data is {
  current: {
    squareIndex: number;
  };
} {
  return (
    (
      data as DataRef<{
        squareIndex: number;
      }>
    ).current?.squareIndex !== undefined
  );
}

export const Board = memo(
  (
    props: Readonly<{
      gameCode: string;
    }>
  ) => {
    const dispatch = useAppDispatch();

    useKey(
      (event) => event.key.toLocaleLowerCase() === "f",
      () => dispatch(flipBoard())
    );

    const squares = useAppSelector((state) => selectSquares(state, props.gameCode));

    const mouseSensor = useSensor(MouseSensor);
    const touchSensor = useSensor(TouchSensor);
    const keyboardSensor = useSensor(KeyboardSensor);

    const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

    function onDragEnd(e: DragEndEvent) {
      const { active, over } = e;

      if (over && isValidDragData(over.data) && isValidDragData(active.data)) {
        dispatch(move("some_game", active.data.current.squareIndex, over.data.current.squareIndex));
      }
    }

    return (
      <DndContext sensors={sensors} onDragEnd={(e) => onDragEnd(e)}>
        <div className="grid w-2/5 grid-cols-8 grid-rows-8">
          {squares.map((square) => (
            <Square key={square.squareIndex} squareIndex={square.squareIndex} />
          ))}
        </div>
      </DndContext>
    );
  }
);
