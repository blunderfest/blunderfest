import { Accordion } from "@/components/Accordion";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentGame, switchGame } from "@/store/slices/roomSlice";

export function GameSelector() {
  const dispatch = useAppDispatch();

  const games = useAppSelector((state) => state.room.games);
  const currentGame = useAppSelector(selectCurrentGame);

  return (
    <section className="bg-surface-2 flex flex-col">
      {games.map((game) => (
        <Accordion
          key={game}
          isOpen={currentGame === game}
          onClick={() =>
            dispatch(
              switchGame({
                gameCode: game,
              })
            )
          }
          text={game}>
          <table className="w-full text-left text-sm text-gray-500 rtl:text-right dark:text-gray-400">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="py-3 px-6" scope="col">
                  #
                </th>
                <th className="py-3 px-6" scope="col">
                  W
                </th>
                <th className="py-3 px-6" scope="col">
                  B
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1.</td>
                <td>d4</td>
                <td>Nf6</td>
              </tr>
              <tr>
                <td>2.</td>
                <td>c4</td>
                <td>c5</td>
              </tr>
              <tr>
                <td>3.</td>
                <td>d5</td>
                <td>b5</td>
              </tr>
            </tbody>
          </table>
        </Accordion>
      ))}
    </section>
  );
}
