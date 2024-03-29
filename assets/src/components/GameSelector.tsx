import { selectGame } from "~/actions/joined";
import { useAppDispatch, useAppSelector } from "~/store/store";

export function GameSelector() {
  const dispatch = useAppDispatch();

  const games = useAppSelector((state) => state.room.games);
  const activeGame = useAppSelector((state) => state.room.activeGame);

  return (
    <ul>
      {games.map((game) => (
        <li key={game} aria-selected={game === activeGame} onClick={() => dispatch(selectGame(game))}>
          {game} {activeGame}
        </li>
      ))}
    </ul>
  );
}
