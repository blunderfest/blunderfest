import { useAppDispatch, useAppSelector } from "@/store";
import { gameSwitched } from "@/store/actions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@radix-ui/react-accordion";
import { forwardRef } from "react";
import { FocusScope } from "react-aria";
import { css } from "styled-system/css";
import { MoveList } from "./MoveList";

/**
 * @param {{
 *   gameCode: string
 * }} props
 * @param {import("react").Ref<HTMLDivElement> | undefined} ref
 */
function _MoveListBox(props, ref) {
  const { gameCode } = props;

  const gameCodes = useAppSelector((state) => state.game.ids);
  const dispatch = useAppDispatch();

  return (
    <Accordion ref={ref} type="single" defaultValue={gameCode} onValueChange={(e) => dispatch(gameSwitched(e))}>
      {gameCodes.map((gameCode) => (
        <AccordionItem key={gameCode} value={gameCode.toString()}>
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
            {gameCode}
          </AccordionTrigger>
          <AccordionContent>
            <FocusScope>
              <MoveList gameCode={gameCode.toString()} />
            </FocusScope>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export const MoveListBox = forwardRef(_MoveListBox);
