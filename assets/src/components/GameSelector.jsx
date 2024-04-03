import { selectGame } from "@/store/actions/selectGame";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { RxChevronDown } from "react-icons/rx";

export function GameSelector() {
  const dispatch = useAppDispatch();

  const games = useAppSelector((state) => state.room.games);
  const activeGame = useAppSelector((state) => state.room.activeGame);

  console.log("Active game", activeGame);

  /**
 *     <Accordion type="single" collapsible onValueChange={(value) => dispatch(selectGame(value))}>
      {games.map((game) => (
        <AccordionItem key={game} value={game}>
          <AccordionTrigger>{game}</AccordionTrigger>
          <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>

 */

  return (
    <div>
      {games.map((game) => (
        <div key={game} value={game}>
          <div onClick={() => dispatch(selectGame(game))}>
            {game}
            <div>
              <RxChevronDown />
            </div>
          </div>
          <div>
            Pudding donut gummies chupa chups oat cake marzipan biscuit tart. Dessert macaroon ice cream bonbon jelly. Jelly
            topping tiramisu halvah lollipop.
          </div>
        </div>
      ))}
    </div>
  );
}
