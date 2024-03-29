import { Accordion } from "@ark-ui/react";
import { RxChevronDown } from "react-icons/rx";
import { selectGame } from "~/actions/joined";
import { useAppDispatch, useAppSelector } from "~/store/store";

export function GameSelector() {
  const dispatch = useAppDispatch();

  const games = useAppSelector((state) => state.room.games);
  const activeGame = useAppSelector((state) => state.room.activeGame);

  console.log(activeGame);

  return (
    <Accordion.Root value={[activeGame]} collapsible onValueChange={(game) => dispatch(selectGame(game.value[0]))}>
      {games.map((game) => (
        <Accordion.Item key={game} value={game}>
          <Accordion.ItemTrigger>
            {game}
            <Accordion.ItemIndicator>
              <RxChevronDown />
            </Accordion.ItemIndicator>
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            Pudding donut gummies chupa chups oat cake marzipan biscuit tart. Dessert macaroon ice cream bonbon jelly. Jelly
            topping tiramisu halvah lollipop.
          </Accordion.ItemContent>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
