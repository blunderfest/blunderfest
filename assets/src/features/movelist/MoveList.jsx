import { useAppSelector } from "@/store";
import { selectMainVariation } from "@/store/games/selectors";
import { useTreeData } from "react-stately";
import { css } from "styled-system/css";

/**
 * @param {{moves: import("@react-stately/data").TreeNode<MappedMove>[]}} props
 */
function Moves(props) {
  const { moves } = props;

  return (
    <ol>
      {moves.map((move) => (
        <Move key={move.key} move={move} />
      ))}
    </ol>
  );
}

/**
 * @param {{move: import("@react-stately/data").TreeNode<MappedMove>}} props
 */
function Move(props) {
  const { move } = props;
  return (
    <li>
      {move.value.id}
      {move.children && <Moves moves={move.children} />}
    </li>
  );
}

/**
 * @param {{
 *   gameId: string,
 *   positionId: string
 * }} props
 */
export function MoveList(props) {
  const { gameId, positionId } = props;

  const variations = useAppSelector((state) => selectMainVariation(state, gameId));

  const tree = useTreeData({
    initialItems: variations,
    getKey: (item) => item.position.id,
    getChildren: (item) => item.variations,
    initialSelectedKeys: [positionId],
  });

  /**
   * @param {number} squareIndex
   */
  function toSquare(squareIndex) {
    const file = squareIndex % 8;
    const rank = Math.floor(squareIndex / 8) + 1;

    return String.fromCharCode(97 + file) + rank;
  }

  /**
   * @param {import("@react-stately/data").TreeNode<Variation>[]} items
   * @param {number} level
   */
  function render(items, level) {
    if (items.length) {
      return (
        <ol
          style={{}}
          className={css({
            marginLeft: `${level * 10}px`,
            backgroundColor: "stone.10",
            color: "stone.1",
          })}>
          {items.map((item) => (
            <li key={item.key}>
              <h1>{item.value.position.ply}</h1>
              {toSquare(item.value.move.from)}
              {toSquare(item.value.move.to)}
              {render(item.children, level + 1)}
            </li>
          ))}
        </ol>
      );
    }

    return null;
  }

  return <div>{render(tree.items, 0)}</div>;
}
