import { useAppDispatch, useAppSelector } from "@/store";
import { useClickAway } from "@uidotdev/usehooks";
import { Grid } from "styled-system/jsx";
import { Square } from "./Square";
import { deselect, mark, select } from "./boardSlice";

export function Board() {
	const board = useAppSelector((state) => state.board);
	const dispatch = useAppDispatch();

	/** @type {import("react").MutableRefObject<HTMLDivElement>} */
	const ref = useClickAway(() => {
		dispatch(deselect());
	});

	return (
		<Grid ref={ref} columns={8} rowGap={0} columnGap={0} height="100vh" aspectRatio="square" backgroundColor="slate.900">
			{board.squares.map((square) => (
				<Square
					key={square.square_index}
					color={square.color}
					selected={square.mark !== "none" ? square.mark : board.selectedSquare === square.square_index ? "highlighted" : "none"}
					onClick={() => dispatch(select(square.square_index))}
					onContextMenu={(e) => {
						dispatch(
							mark({
								square: square.square_index,
								alt: e.altKey,
								ctrl: e.ctrlKey,
							}),
						);
					}}
					piece={square.piece}
				></Square>
			))}
		</Grid>
	);
}
