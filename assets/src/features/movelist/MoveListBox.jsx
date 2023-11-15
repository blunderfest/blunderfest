import { useAppDispatch, useAppSelector } from "@/store";
import { gameSwitched } from "@/store/actions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@radix-ui/react-accordion";
import { forwardRef } from "react";
import { FocusScope } from "react-aria";
import { css } from "styled-system/css";
import { MoveList } from "./MoveList";

/**
 * @param {{
 *   gameId: string
 * }} props
 * @param {import("react").Ref<HTMLDivElement> | undefined} ref
 */
function _MoveListBox(props, ref) {
  const { gameId } = props;

  const gameIds = useAppSelector((state) => state.game.ids);
  const dispatch = useAppDispatch();

  return (
    <Accordion ref={ref} type="single" defaultValue={gameId} onValueChange={(e) => dispatch(gameSwitched(e))}>
      {gameIds.map((gameId) => (
        <AccordionItem key={gameId} value={gameId.toString()}>
          <AccordionTrigger
            className={css({
              width: "140px",
              _open: {
                color: "primary",
                backgroundColor: "secondary",
              },
              _close: {
                backgroundColor: "primary",
                color: "secondary",
              },
            })}>
            {gameId}
          </AccordionTrigger>
          <AccordionContent>
            <FocusScope>
              <MoveList gameId={gameId.toString()} />
            </FocusScope>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export const MoveListBox = forwardRef(_MoveListBox);
