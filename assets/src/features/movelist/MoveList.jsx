import { useAppSelector } from "@/store";
import { selectVariation } from "@/store/variationReducer";

/**
 * @param {{
 *   gameId: string,
 *   positionId: string
 * }} props
 */
export function MoveList(props) {
  const { gameId, positionId } = props;

  const variation = useAppSelector((state) => selectVariation(state, gameId));
  const variations = variation ? [variation] : [];

  return <></>;
}
