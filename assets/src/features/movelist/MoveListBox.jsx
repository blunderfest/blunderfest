import { useAppDispatch, useAppSelector } from "@/store";
import { gameSwitched } from "@/store/actions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@radix-ui/react-accordion";
import { css } from "styled-system/css";
import { MoveList } from "./MoveList";

/**
 * @param {{
 *   gameId: string,
 *   positionId: string
 * }} props
 */
export function MoveListBox(props) {
  const { gameId, positionId } = props;

  const gameIds = useAppSelector((state) => state.game.ids);

  const dispatch = useAppDispatch();

  return (
    <Accordion type="single" defaultValue={gameId} onValueChange={(e) => dispatch(gameSwitched(e))}>
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
            <MoveList gameId={gameId.toString()} positionId={positionId} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
