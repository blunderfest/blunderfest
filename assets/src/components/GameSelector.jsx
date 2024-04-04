import { Accordion } from "@/components/Accordion";
import { selectGame } from "@/store/actions/selectGame";
import { useAppDispatch, useAppSelector } from "@/store/store";

export function GameSelector() {
  const dispatch = useAppDispatch();

  const games = useAppSelector((state) => state.room.games);
  const activeGame = useAppSelector((state) => state.room.activeGame);

  return (
    <section className="flex w-96 flex-col space-y-2 bg-surface-2">
      {games.map((game) => (
        <Accordion key={game} isOpen={activeGame === game} onClick={() => dispatch(selectGame(game))} text={game}>
          <table className="w-full text-left text-sm text-gray-500 rtl:text-right dark:text-gray-400">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3" scope="col">
                  #
                </th>
                <th className="px-6 py-3" scope="col">
                  W
                </th>
                <th className="px-6 py-3" scope="col">
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
