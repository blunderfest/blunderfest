import { Square } from "./Square";
import { useKey } from "react-use";
import { DndContext, DragEndEvent, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { actions } from "@/store";

export const Board = (props: Readonly<{ gameCode: string }>) => {
  function handleDragEnd(e: DragEndEvent, gameCode: string) {
    const { active, over } = e;

    if (over?.data.current?.squareIndex && active.data.current?.squareIndex) {
      actions.move(gameCode, active.data.current.squareIndex, over.data.current.squareIndex);
    }
  }

  const [flipped, setFlipped] = useState(false);

  useKey(
    (event) => event.key.toLocaleLowerCase() === "f",
    () => setFlipped((flipped) => !flipped)
  );

  const mouseSensor = useSensor(MouseSensor);
  const touchSensor = useSensor(TouchSensor);
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const ranks = flipped ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
  const files = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];

  const squares = ranks.flatMap((rank) => files.map((file) => rank * 8 + file));

  return (
    <DndContext sensors={sensors} onDragEnd={(e) => handleDragEnd(e, props.gameCode)}>
      <div className="grid w-2/5 grid-cols-8 grid-rows-8">
        {squares.map((squareIndex) => (
          <Square key={squareIndex} squareIndex={squareIndex} />
        ))}
      </div>
    </DndContext>
  );
};
